"""
The real classification step: a CrewAI agent backed by a multimodal LLM
(text + image together), forced into the ClassificationResult shape via
structured output rather than free-text parsing.

Assumes guards/image_check.is_valid() has already passed for this product
before this module is ever called.
"""

import logging
import os
import time

from crewai import Agent, Crew, LLM, Task
from google.genai.errors import ServerError
from litellm.exceptions import RateLimitError, Timeout, APIConnectionError
from pydantic import BaseModel, Field

from models.schemas import Category, ClassificationResult, Product

logging.basicConfig(
    filename="classification.log",
    level=logging.INFO,

    format="%(asctime)s - %(levelname)s - %(message)s",
)


class _LLMOutput(BaseModel):
    """
    Internal-only schema: exactly the fields the LLM is allowed to produce.
    Deliberately excludes product_id, requires_human_review, review_notes,
    and status — those are never the model's to decide (see schemas.py).
    """
    flagged: bool
    category: Category
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str
    text_image_mismatch: bool


def _build_llm() -> LLM:
    return LLM(
        model="gemini/gemini-3.6-flash",
        api_key=os.environ["GEMINI_API_KEY"],
        temperature=0.0,
        timeout=30,  # يقطع الطلب لو ما رد خلال 30 ثانية
    )


def _build_agent(llm: LLM) -> Agent:
    return Agent(
        role="Product Safety Classifier",
        goal=(
            "Determine whether a marketplace listing (text + image) shows a "
            "weapon, counterfeit good, or no violation, by comparing what "
            "the text claims against what the image actually shows."
        ),
        backstory=(
            "An expert trust-and-safety reviewer trained to catch listings "
            "where sellers hide illicit items behind misleading text."
        ),
        llm=llm,
        multimodal=True,
        verbose=False,
    )


def _build_task(agent: Agent, product: Product) -> Task:
    return Task(
        description=(
            f"Review this marketplace listing.\n\n"
            f"Name: {product.name}\n"
            f"Description: {product.description}\n"
            f"Image: {product.image_url}\n\n"
            "Decide if this listing should be flagged as a weapon or "
            "counterfeit good. Compare the text against what the image "
            "actually shows, and set text_image_mismatch=true if they "
            "disagree (e.g. description says 'toy' but the image shows a "
            "real firearm). Be conservative: only flag with reasonable "
            "evidence, and explain your reasoning clearly."
        ),
        expected_output=(
            "A structured classification: flagged, category, confidence, "
            "reasoning, and text_image_mismatch."
        ),
        agent=agent,
        output_pydantic=_LLMOutput,
    )


def _classify_once(product: Product) -> ClassificationResult:
    """Single attempt, no retry logic — kept separate so retry wrapping stays clean."""
    llm = _build_llm()
    agent = _build_agent(llm)
    task = _build_task(agent, product)

    Crew(agents=[agent], tasks=[task], verbose=False).kickoff()

    llm_output: _LLMOutput = task.output.pydantic

    return ClassificationResult(
        product_id=product.id,
        **llm_output.model_dump(),
    )


def classify(product: Product, max_retries: int = 3) -> ClassificationResult:
    """
    Runs the multimodal agent on a single product and returns a
    ClassificationResult with the LLM-provided fields filled in.
    requires_human_review, review_notes, and status are left at their
    defaults here — verification.py is responsible for setting those.

    Retries on RateLimitError and ServerError (e.g. Gemini's "high demand,
    try again later" 503) with exponential backoff. Timeout and connection
    errors are logged and re-raised immediately (retrying won't fix a dead
    connection or a genuinely slow/broken endpoint the same way it fixes a
    transient capacity/quota issue).
    """
    for attempt in range(max_retries):
        try:
            result = _classify_once(product)
            logging.info(
            f"product_id={product.id} CLASSIFICATION_SUCCESS attempt={attempt + 1} "
            f"flagged={result.flagged} confidence={result.confidence}"
            )
            return result

        except (RateLimitError, ServerError):
            if attempt == max_retries - 1:
                logging.error(
                    f"product_id={product.id} FAILED after {max_retries} "
                    "attempts (rate limit / server unavailable)"
                )
                raise
            wait_time = 2 ** attempt  # 1, 2, 4 seconds
            logging.warning(
                f"product_id={product.id} TRANSIENT_ERROR attempt={attempt + 1}, "
                f"waiting {wait_time}s before retry"
            )
            time.sleep(wait_time)

        except Timeout:
            logging.error(f"product_id={product.id} TIMEOUT")
            raise

        except APIConnectionError:
            logging.error(f"product_id={product.id} CONNECTION_ERROR")
            raise

        except Exception as e:
            # Anything else (validation errors, auth errors, etc.) — don't
            # retry, since retrying won't fix a malformed schema or a bad
            # API key.
            logging.error(f"product_id={product.id} UNEXPECTED_ERROR: {e}")
            raise