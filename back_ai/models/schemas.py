"""
Shared data contracts for the pipeline.

Every stage (image_check -> classification_agent -> verification -> orchestrator)
passes typed objects defined here instead of raw dicts/JSON. See project notes:
JSON only at true boundaries (LLM call, DB write) — typed objects everywhere internal.
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, HttpUrl


class Category(str, Enum):
    """Closed set of categories. The LLM must pick one of these — it cannot invent a new one."""
    WEAPON = "weapon"
    COUNTERFEIT = "counterfeit"
    NONE = "none"


class ReviewStatus(str, Enum):
    """
    Distinguishes *why* a product ended up needing attention:
    - a genuine policy violation vs.
    - a technical problem with the image itself (image_check.py's job)
    """
    APPROVED = "approved"
    FLAGGED_FOR_REVIEW = "flagged_for_review"
    REJECTED_VIOLATION = "rejected_violation"
    REJECTED_INVALID_IMAGE = "rejected_invalid_image"


class Product(BaseModel):
    """Input shape: what a 'product' looks like going INTO the pipeline."""
    id: str
    name: str
    description: str
    image_url: str  


class ClassificationResult(BaseModel):
    """
    Output shape: what comes OUT of the pipeline.

    flagged / category / confidence / reasoning / text_image_mismatch
        -> produced by classification_agent.py (the LLM call)

    requires_human_review / review_notes
        -> NEVER set by the LLM. Only verification.py may set these.
           Keeping them separate prevents confusing "something the model said"
           with "something the code decided."
    """
    product_id: str
    flagged: bool
    category: Category
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str
    text_image_mismatch: bool

    # Set only by verification.py, never by the LLM
    requires_human_review: bool = False
    review_notes: Optional[str] = None
    status: Optional[ReviewStatus] = None