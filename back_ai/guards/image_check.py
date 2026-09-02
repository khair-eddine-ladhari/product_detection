"""
Cheap, non-LLM technical check on a product image, run BEFORE we pay for a
vision model call. This does not judge content — only whether the image
itself is usable (reachable, non-empty, a real image, not corrupted).

Anything that fails here short-circuits the pipeline with
ReviewStatus.REJECTED_INVALID_IMAGE, before classification_agent.py is
ever invoked.
"""

import io

import httpx
from PIL import Image, UnidentifiedImageError

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB safety cap
REQUEST_TIMEOUT_SECONDS = 5.0


def is_valid(image_url: str) -> bool:
    """
    Returns True only if the image is fetchable, non-empty, under the size
    cap, and decodable as a real image. Any failure returns False rather
    than raising, so orchestrator.py can treat this as a plain boolean gate.
    """
    try:
        response = httpx.get(
            image_url,
            timeout=REQUEST_TIMEOUT_SECONDS,
            follow_redirects=True,
        )
        response.raise_for_status()
    except (httpx.HTTPError, httpx.TimeoutException):
        return False

    content = response.content
    if not content:
        return False

    if len(content) > MAX_IMAGE_BYTES:
        return False

    try:
        with Image.open(io.BytesIO(content)) as img:
            img.verify()  # checks the image is not truncated/corrupted
    except (UnidentifiedImageError, OSError):
        return False

    return True