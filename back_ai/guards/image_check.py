import base64
import binascii
import io

import httpx
from PIL import Image, UnidentifiedImageError

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB safety cap
REQUEST_TIMEOUT_SECONDS = 5.0


def _load_bytes(image_url: str) -> bytes | None:
    """Returns raw image bytes from either a data: URI or an http(s) URL, or None on failure."""
    if image_url.startswith("data:"):
        try:
            header, encoded = image_url.split(",", 1)
            return base64.b64decode(encoded)
        except (ValueError, binascii.Error):
            return None

    try:
        response = httpx.get(
            image_url,
            timeout=REQUEST_TIMEOUT_SECONDS,
            follow_redirects=True,
        )
        response.raise_for_status()
        return response.content
    except (httpx.HTTPError, httpx.TimeoutException):
        return None


def is_valid(image_url: str) -> bool:
    """
    Returns True only if the image is loadable (via URL fetch or base64
    decode), non-empty, under the size cap, and decodable as a real image.
    Any failure returns False rather than raising, so orchestrator.py can
    treat this as a plain boolean gate.
    """
    content = _load_bytes(image_url)
    if not content:
        return False

    if len(content) > MAX_IMAGE_BYTES:
        return False

    try:
        with Image.open(io.BytesIO(content)) as img:
            img.verify()
    except (UnidentifiedImageError, OSError):
        return False

    return True