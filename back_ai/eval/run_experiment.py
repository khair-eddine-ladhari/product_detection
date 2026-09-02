"""
Runs the full pipeline against every example in the LangSmith dataset and
scores each result against the expected outputs.

Run:
    python eval/run_experiment.py
"""

from dotenv import load_dotenv
load_dotenv()



from langsmith import Client
from langsmith.evaluation import evaluate

from models.schemas import Product
from orchestrator import process_product

DATASET_NAME = "illicit-detection-eval"


def target(inputs: dict) -> dict:
    """
    Wraps process_product so LangSmith can call it with a plain dict and
    get a plain dict back (LangSmith doesn't know about our Pydantic types).
    """
    product = Product(**inputs)
    result = process_product(product)
    return {
        "flagged": result.flagged,
        "category": result.category.value,
        "text_image_mismatch": result.text_image_mismatch,
    }


def classification_correct(outputs: dict, reference_outputs: dict) -> bool:
    """
    Core correctness check: flagged and category must match exactly.
    text_image_mismatch is reported separately since it's a harder,
    more subjective judgment call for the model.
    """
    return (
        outputs["flagged"] == reference_outputs["flagged"]
        and outputs["category"] == reference_outputs["category"]
    )


def mismatch_detection_correct(outputs: dict, reference_outputs: dict) -> bool:
    """Separate score: did we correctly detect text-image concealment?"""
    return outputs["text_image_mismatch"] == reference_outputs["text_image_mismatch"]


def main():
    client = Client()

    results = evaluate(
        target,
        data=DATASET_NAME,
        evaluators=[classification_correct, mismatch_detection_correct],
        experiment_prefix="illicit-detection",
        metadata={"pipeline_version": "gemini-3.6-flash"},
    )

    print(results)


if __name__ == "__main__":
    main()