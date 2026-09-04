"""
The real classification step: a CrewAI agent backed by a multimodal LLM
(text + image together), forced into the ClassificationResult shape via
structured output rather than free-text parsing.

Assumes guards/image_check.is_valid() has already passed for this product
before this module is ever called.
"""

import base64
import logging
import mimetypes
import os
import time
import urllib.request

from crewai import Agent, Crew, LLM, Task
from crewai_files import FileBytes, ImageFile
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


def _fetch_url_bytes(url: str) -> tuple[bytes, str]:
    """
    Downloads an image URL ourselves and returns (bytes, extension).

    We do this instead of handing the raw URL to ImageFile/CrewAI, because
    letting the provider fetch the URL server-side failed silently on URLs
    without a recognizable image extension (e.g. CDN URLs with query-string
    params like "...?fmt=auto&h=434&w=652" and no ".jpg"/".png" suffix) —
    the model proceeded without ever seeing the image and hallucinated a
    plausible-sounding match to the listing text instead of raising an
    error, which is much harder to catch than a clear failure here.
    """
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=15) as response:
        image_bytes = response.read()
        content_type = response.headers.get_content_type()  # e.g. "image/jpeg"

    if not image_bytes:
        raise ValueError(f"Downloaded 0 bytes from image URL: {url}")

    extension = mimetypes.guess_extension(content_type or "") or ".jpg"
    return image_bytes, extension.lstrip(".")


def _image_file_from_source(source: str) -> ImageFile:
    """
    product.image_url may be either:
      - a real URL (http/https) -> we download it ourselves into bytes
        (see _fetch_url_bytes) rather than trusting provider-side URL
        fetching, which silently failed on some CDN-style URLs.
      - a data URI (data:image/jpeg;base64,...) -> ImageFile.source does
        NOT accept this format directly (only paths, URLs, or bytes), so
        we decode it ourselves and hand it raw bytes via FileBytes.

    Without this, a data URI gets misinterpreted as a filesystem path and
    fails with "File not found" (see classification.log UNEXPECTED_ERROR
    entries from before this fix).
    """
    if source.startswith("http://") or source.startswith("https://"):
        image_bytes, extension = _fetch_url_bytes(source)
        return ImageFile(source=FileBytes(data=image_bytes, filename=f"listing.{extension}"))

    if source.startswith("data:"):
        header, _, encoded = source.partition(",")
        if not encoded:
            raise ValueError(f"Malformed data URI for image_url: {source[:50]}...")

        mime_type = header[len("data:"):].split(";")[0]  # e.g. "image/jpeg"
        extension = mime_type.split("/")[-1] if "/" in mime_type else "jpg"

        image_bytes = base64.b64decode(encoded)
        return ImageFile(source=FileBytes(data=image_bytes, filename=f"listing.{extension}"))

    raise ValueError(
        f"Unrecognized image_url format (expected http(s) URL or data URI): "
        f"{source[:50]}..."
    )

def _build_task(agent: Agent, product: Product, image_file: ImageFile) -> Task:
    return Task(
        description=(
            f"Review this marketplace listing.\n\n"
            f"Name: {product.name}\n"
            f"Description: {product.description}\n\n"
            "An image of the listed item is attached to this task — "
            "inspect it directly. Decide if this listing should be "
            "flagged as a weapon or counterfeit good. Compare the text "
            "against what the image actually shows, and set "
            "text_image_mismatch=true if they disagree (e.g. description "
            "says 'toy' but the image shows a real firearm). Be "
            "conservative: only flag with reasonable evidence."
        ),
        expected_output=(
            "A structured classification: flagged, category, confidence, "
            "reasoning, and text_image_mismatch."
        ),
        agent=agent,
        output_pydantic=_LLMOutput,
        input_files={"listing_image": image_file},
    )


def _classify_once(product: Product, image_file: ImageFile) -> ClassificationResult:
    """Single attempt, no retry logic — kept separate so retry wrapping stays clean."""
    llm = _build_llm()
    agent = _build_agent(llm)
    task = _build_task(agent, product, image_file)

    Crew(agents=[agent], tasks=[task], verbose=False).kickoff()

    llm_output: _LLMOutput = task.output.pydantic

    return ClassificationResult(
        product_id=product.id,
        **llm_output.model_dump(),
    )


def classify(product: Product, image_file: ImageFile, max_retries: int = 3) -> ClassificationResult:
    """
    Runs the multimodal agent on a single product and returns a
    ClassificationResult with the LLM-provided fields filled in.

    image_file is fetched once by the caller (orchestrator.py) and reused
    here and in adversarial_review_agent.review() — avoids re-downloading
    the same image multiple times across the pipeline.
    """
    for attempt in range(max_retries):
        try:
            result = _classify_once(product, image_file)
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
            wait_time = 2 ** attempt
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
            logging.error(f"product_id={product.id} UNEXPECTED_ERROR: {e}")
            raise