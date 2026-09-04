"""
Coordinates the full pipeline for a single product:

    image_check.is_valid  ->  classification_agent.classify  ->  verification.verify

Each stage passes/returns typed objects from models.schemas — no raw
dicts or JSON crossing these boundaries (see project notes).

The listing image is downloaded exactly ONCE here (via
_image_file_from_source) and threaded through both classification_agent
and, if triggered, adversarial_review_agent — rather than each agent
independently re-fetching the same CDN image. This was previously a
major contributor to pipeline latency (2-3 redundant downloads of the
same image per product, stacked with two independent LLM calls each
with their own retry loop).
"""

import logging

from agents import classification_agent
from agents.classification_agent import _image_file_from_source
from guards import image_check, verification
from models.schemas import Category, ClassificationResult, Product, ReviewStatus

logging.basicConfig(
    filename="classification.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)


def _reject_invalid_image(product: Product) -> ClassificationResult:
    """
    Short-circuit result for a product whose image failed the technical
    check. Never reaches classification_agent, so there is no LLM cost
    for a broken/empty/corrupted image.
    """
    result = ClassificationResult(
        product_id=product.id,
        flagged=False,
        category=Category.NONE,
        confidence=0.0,
        reasoning="Image failed technical validation (unreachable, empty, or corrupted).",
        text_image_mismatch=False,
        requires_human_review=True,
        review_notes="Rejected before classification: invalid image.",
        status=ReviewStatus.REJECTED_INVALID_IMAGE,
    )
    logging.info(
        f"product_id={product.id} PIPELINE_COMPLETE status={result.status} "
        f"reason=invalid_image"
    )
    return result


def process_product(product: Product) -> ClassificationResult:
    """
    Runs the full pipeline for one product and returns the final,
    verified ClassificationResult.
    """
    # 1. Cheap technical check, no LLM cost.
    if not image_check.is_valid(str(product.image_url)):
        return _reject_invalid_image(product)

    # 2. Fetch the listing image ONCE. Reused by classification_agent.classify()
    #    below and, if verification.verify() triggers a second opinion, by
    #    adversarial_review_agent.review() too — avoids downloading the same
    #    image 2-3 times per product.
    image_file = _image_file_from_source(str(product.image_url))

    # 3. Real classification: multimodal LLM (text + image together).
    llm_result = classification_agent.classify(product, image_file)

    # 4. Independent, rule-based verification of the LLM's output.
    verified_result = verification.verify(product, llm_result, image_file)

    logging.info(
        f"product_id={product.id} PIPELINE_COMPLETE status={verified_result.status} "
        f"flagged={verified_result.flagged} "
        f"requires_review={verified_result.requires_human_review}"
    )

    return verified_result