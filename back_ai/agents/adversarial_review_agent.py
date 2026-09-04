"""
Adversarial second-opinion agent.

Runs AFTER classification_agent.py has already produced a ClassificationResult.
Only triggered for borderline verdicts (see should_trigger_review below) —
running this on every listing would double the LLM cost for no benefit on
clear-cut cases.

This agent is deliberately told to argue AGAINST the first agent's verdict,
not to independently re-classify from scratch. The goal isn't "get a second
vote" — it's "actively try to find a reason the first verdict is wrong."
If it still can't find one, that's a much stronger signal than one agent
simply agreeing with itself.
"""

import logging
import os

from crewai import Agent, Crew, LLM, Task
from google.genai.errors import ServerError
from litellm.exceptions import RateLimitError, Timeout, APIConnectionError
from pydantic import BaseModel

from models.schemas import ClassificationResult, Product

logging.basicConfig(
    filename="classification.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

# Verdicts with confidence inside this band are considered "shaky enough to
# double-check." Outside this band, the first agent's own confidence is
# already doing its job.
CONFIDENCE_REVIEW_LOW = 0.4
CONFIDENCE_REVIEW_HIGH = 0.7


class _ReviewLLMOutput(BaseModel):
    """
    Internal-only schema: the adversarial reviewer only judges whether the
    FIRST agent's specific verdict holds up — it doesn't re-derive category/
    confidence/etc. from scratch the way classification_agent.py does.
    """
    agrees_with_verdict: bool
    counter_reasoning: str


def should_trigger_review(result: ClassificationResult) -> bool:
    """
    Decides whether a verdict is shaky enough to warrant a second opinion.
    Triggers on:
      - confidence sitting in the ambiguous middle band, or
      - a flagged text/image mismatch (these are exactly the adversarial
        cases sellers construct on purpose, so worth the extra scrutiny
        even at higher confidence).
    """
    if CONFIDENCE_REVIEW_LOW <= result.confidence <= CONFIDENCE_REVIEW_HIGH:
        return True
    if result.text_image_mismatch:
        return True
    return False


def _build_llm() -> LLM:
    return LLM(
        model="gemini/gemini-3.6-flash",
        api_key=os.environ["GEMINI_API_KEY"],
        temperature=0.0,
        timeout=30,
    )


def _build_agent(llm: LLM) -> Agent:
    return Agent(
        role="Adversarial Second Reviewer",
        goal=(
            "Given a marketplace listing AND another reviewer's verdict on "
            "it, actively try to find a reason that verdict is wrong. Do "
            "not simply agree — argue the opposite position first, then "
            "only concede agreement if no reasonable counter-argument "
            "holds up."
        ),
        backstory=(
            "A skeptical trust-and-safety auditor whose entire job is to "
            "stress-test other reviewers' decisions before they become "
            "final, catching both false positives (harmless listings "
            "wrongly flagged) and false negatives (real violations that "
            "slipped through)."
        ),
        llm=llm,
        multimodal=True,
        verbose=False,
    )


def _build_task(agent: Agent, product: Product, first_result: ClassificationResult) -> Task:
    return Task(
        description=(
            f"Listing under review:\n"
            f"Name: {product.name}\n"
            f"Description: {product.description}\n"
            f"Image: {product.image_url}\n\n"
            f"A first reviewer reached this verdict:\n"
            f"flagged={first_result.flagged}, category={first_result.category}, "
            f"confidence={first_result.confidence}, "
            f"text_image_mismatch={first_result.text_image_mismatch}\n"
            f"Their reasoning: {first_result.reasoning}\n\n"
            "Your job: actively try to argue AGAINST this verdict. Look "
            "for any reasonable alternative explanation the first reviewer "
            "may have missed. Only agree if, after genuinely trying to "
            "find a counter-argument, none holds up. Set "
            "agrees_with_verdict=false if you find a credible reason the "
            "verdict is wrong, and explain that reason in counter_reasoning."
        ),
        expected_output=(
            "A structured judgment: agrees_with_verdict and counter_reasoning."
        ),
        agent=agent,
        output_pydantic=_ReviewLLMOutput,
    )


def review(product: Product, first_result: ClassificationResult, max_retries: int = 3) -> _ReviewLLMOutput:
    """
    Runs the adversarial second-opinion agent. Same retry strategy as
    classification_agent.classify(): retry transient rate-limit/server
    errors with backoff, surface timeout/connection errors immediately.
    """
    for attempt in range(max_retries):
        try:
            llm = _build_llm()
            agent = _build_agent(llm)
            task = _build_task(agent, product, first_result)

            Crew(agents=[agent], tasks=[task], verbose=False).kickoff()

            output: _ReviewLLMOutput = task.output.pydantic
            logging.info(
                f"product_id={product.id} SECOND_OPINION_SUCCESS attempt={attempt + 1} "
                f"agrees={output.agrees_with_verdict}"
            )
            return output

        except (RateLimitError, ServerError):
            if attempt == max_retries - 1:
                logging.error(
                    f"product_id={product.id} SECOND_OPINION_FAILED after "
                    f"{max_retries} attempts (rate limit / server unavailable)"
                )
                raise
            wait_time = 2 ** attempt
            logging.warning(
                f"product_id={product.id} SECOND_OPINION_TRANSIENT_ERROR "
                f"attempt={attempt + 1}, waiting {wait_time}s before retry"
            )
            import time
            time.sleep(wait_time)

        except Timeout:
            logging.error(f"product_id={product.id} SECOND_OPINION_TIMEOUT")
            raise

        except APIConnectionError:
            logging.error(f"product_id={product.id} SECOND_OPINION_CONNECTION_ERROR")
            raise

        except Exception as e:
            logging.error(f"product_id={product.id} SECOND_OPINION_UNEXPECTED_ERROR: {e}")
            raise