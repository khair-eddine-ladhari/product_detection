"""
FastAPI entrypoint for the pipeline. Exposes a single endpoint that takes
a Product and runs it through image_check -> classification_agent ->
verification, returning the final ClassificationResult.

Usage:
    uvicorn main:app --reload
"""
import crewai.llms.cache as _crewai_cache
_crewai_cache.mark_cache_breakpoint = lambda msg: msg
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import ValidationError

from models.schemas import ClassificationResult, Product
from orchestrator import process_product

load_dotenv()  # reads GROQ_API_KEY from .env

app = FastAPI(
    title="Illicit Detection Agent",
    description="Classifies marketplace listings (text + image) as weapon, counterfeit, or none.",
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/classify", response_model=ClassificationResult)
def classify(product: Product) -> ClassificationResult:
    """
    Runs a single product through the full pipeline. FastAPI validates the
    incoming JSON against Product automatically before this function is
    even called — malformed requests never reach the pipeline.
    """
    try:
        return process_product(product)
    except ValidationError as exc:
        # Defensive: should not normally trigger since FastAPI already
        # validated the request body against Product.
        raise HTTPException(status_code=422, detail=str(exc))