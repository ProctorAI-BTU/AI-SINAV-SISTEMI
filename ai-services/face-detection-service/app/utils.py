import base64
import binascii
import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)

MAX_IMAGE_BYTES = 5 * 1024 * 1024
MIN_WIDTH = 64
MIN_HEIGHT = 64


def decode_base64_image(image_base64: str) -> np.ndarray | None:
    """Decode a raw base64 image or browser data URL into an OpenCV image."""
    try:
        if not image_base64 or not isinstance(image_base64, str):
            return None

        if "," in image_base64 and image_base64.lstrip().startswith("data:"):
            image_base64 = image_base64.split(",", 1)[1]

        image_base64 = image_base64.strip()
        padding = 4 - len(image_base64) % 4
        if padding != 4:
            image_base64 += "=" * padding

        img_bytes = base64.b64decode(image_base64, validate=True)
        if len(img_bytes) > MAX_IMAGE_BYTES:
            logger.warning(f"Image is too large: {len(img_bytes)} bytes")
            return None

        nparr = np.frombuffer(img_bytes, np.uint8)
        return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    except (binascii.Error, ValueError) as e:
        logger.error(f"Base64 decode error: {e}")
        return None
    except Exception as e:
        logger.error(f"Image decode error: {e}")
        return None


def validate_image(img: np.ndarray | None) -> bool:
    """Return whether the decoded image is usable for detection."""
    if img is None:
        return False
    if len(img.shape) < 2:
        return False
    h, w = img.shape[:2]
    if w < MIN_WIDTH or h < MIN_HEIGHT:
        logger.warning(f"Image is too small: {w}x{h}")
        return False
    return True


def normalize_confidence(value: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    """Clamp confidence into the 0.0-1.0 range."""
    clamped = max(min_val, min(max_val, value))
    return round(clamped, 4)


def bgr_to_rgb(img: np.ndarray) -> np.ndarray:
    """Convert OpenCV BGR images to RGB for MediaPipe."""
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
