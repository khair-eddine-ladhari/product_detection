"""
Coordinates the full pipeline for a single product:

    image_check.is_valid  ->  classification_agent.classify  ->  verification.verify

Each stage passes/returns typed objects from models.schemas — no raw
dicts or JSON crossing these boundaries (see project notes).
"""

import logging

from agents import classification_agent
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

    # 2. Real classification: multimodal LLM (text + image together).
    llm_result = classification_agent.classify(product)

    # 3. Independent, rule-based verification of the LLM's output.
    verified_result = verification.verify(product, llm_result)

    logging.info(
        f"product_id={product.id} PIPELINE_COMPLETE status={verified_result.status} "
        f"flagged={verified_result.flagged} "
        f"requires_review={verified_result.requires_human_review}"
    )

    return verified_result