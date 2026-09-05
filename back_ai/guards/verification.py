"""
Independent check on the LLM's classification output. This does not re-run
the LLM (except for one deliberate, targeted case — see Rule 5) — it mostly
applies plain code rules to catch cases where the model's output is
internally inconsistent, under-confident, or otherwise needs a human to
look at it.

This is the ONLY place requires_human_review, review_notes, and status
are ever set (see models/schemas.py).
"""

from crewai_files import ImageFile

from agents import adversarial_review_agent
from models.schemas import Category, ClassificationResult, Product, ReviewStatus

# Below this confidence, even a "not flagged" result gets a second look.
LOW_CONFIDENCE_THRESHOLD = 0.6

# Flagged results below this confidence are not auto-rejected outright.
HIGH_CONFIDENCE_THRESHOLD = 0.85

# Keywords that, if present anywhere in the listing text, force human
# review regardless of what the LLM concluded — a deterministic, code-only
# check that can't be reasoned around the way an LLM's own judgment can.
# Intentionally includes common misspellings/leetspeak sellers might use
# to dodge the classifier (e.g. "weapen", "wepon").
SUSPICIOUS_KEYWORDS = [
    # Weapon-related
    "weapon", "weapen", "wepon", "gun", "pistol", "rifle", "knife",
    "blade", "firearm", "ammo", "ammunition",
    # Counterfeit-related
    "replica", "fake", "counterfeit", "knockoff", "knock-off",
    "1:1", "aaa quality", "mirror quality", "unauthorized copy",
]


def _contains_suspicious_keyword(product: Product) -> str | None:
    text = f"{product.name} {product.description}".lower()
    print(f"DEBUG keyword check text: {text!r}", flush=True)
    for keyword in SUSPICIOUS_KEYWORDS:
        if keyword in text:
            print(f"DEBUG matched keyword: {keyword!r}", flush=True)
            return keyword
    return None

def verify(
    product: Product,
    result: ClassificationResult,
    image_file: ImageFile,
) -> ClassificationResult:
    """
    Applies rule-based sanity checks on top of the LLM's ClassificationResult
    and returns an updated copy with requires_human_review, review_notes,
    and status filled in.

    image_file is the same ImageFile already fetched once in
    orchestrator.py and used by classification_agent.classify() — passed
    through here so adversarial_review_agent.review() doesn't re-download
    the image a second/third time.
    """
    notes: list[str] = []
    requires_review = False

    # Rule 1: text/image mismatch is inherently suspicious, regardless of category.
    if result.text_image_mismatch:
        requires_review = True
        notes.append("Text and image appear to disagree.")

    # Rule 1b: deterministic keyword check on the raw text, independent of
    # the LLM's own text_image_mismatch judgment. Catches cases where the
    # LLM decides a weapon/counterfeit-related word in the title isn't
    # "mismatched" enough given a clean-looking image, but the word itself
    # is still a red flag worth a human looking at regardless.
    matched_keyword = _contains_suspicious_keyword(product)
    if matched_keyword:
        requires_review = True
        notes.append(f"Listing text contains flagged keyword: '{matched_keyword}'.")

    # Rule 2: a flagged result should never be trusted if the model is unsure.
    if result.flagged and result.confidence < HIGH_CONFIDENCE_THRESHOLD:
        requires_review = True
        notes.append(
            f"Flagged as {result.category.value} but confidence "
            f"({result.confidence:.2f}) is below the auto-reject threshold."
        )

    # Rule 3: an unflagged result that's still low-confidence shouldn't be
    # auto-approved either — the model may simply be unsure either way.
    if not result.flagged and result.confidence < LOW_CONFIDENCE_THRESHOLD:
        requires_review = True
        notes.append(
            f"Not flagged, but confidence ({result.confidence:.2f}) is low."
        )

    # Rule 4: category/flagged consistency — a flagged result must not claim NONE,
    # and a non-flagged result should not claim a violation category.
    if result.flagged and result.category == Category.NONE:
        requires_review = True
        notes.append("Flagged as a violation but category is NONE — inconsistent output.")
    if not result.flagged and result.category != Category.NONE:
        requires_review = True
        notes.append(
            f"Not flagged, but category is {result.category.value} — inconsistent output."
        )

    # Rule 5: adversarial second opinion. Only triggered for verdicts that
    # are already borderline (see should_trigger_review) — running this on
    # every listing would double LLM cost for no benefit on clear-cut cases.
    # A disagreeing second opinion forces human review regardless of what
    # the first four rules concluded, since two independent reviewers
    # disagreeing is itself the strongest signal that the case is genuinely
    # ambiguous.
    #
    # image_file is reused here (not re-fetched) — see orchestrator.py.
    if adversarial_review_agent.should_trigger_review(result):
        second_opinion = adversarial_review_agent.review(product, result, image_file)
        if not second_opinion.agrees_with_verdict:
            requires_review = True
            notes.append(
                f"Second opinion disagreed with the verdict: "
                f"{second_opinion.counter_reasoning}"
            )

    # Decide final status.
    if requires_review:
        status = ReviewStatus.FLAGGED_FOR_REVIEW
    elif result.flagged:
        status = ReviewStatus.REJECTED_VIOLATION
    else:
        status = ReviewStatus.APPROVED

    return result.model_copy(
        update={
            "requires_human_review": requires_review,
            "review_notes": " ".join(notes) if notes else None,
            "status": status,
        }
    )