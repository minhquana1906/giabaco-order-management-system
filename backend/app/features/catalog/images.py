"""Product image validation and WebP optimisation; lookup of the image shown for a product."""

import io
import uuid
from dataclasses import dataclass

from PIL import Image, ImageOps
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.catalog.models import ProductImage
from app.features.catalog.schemas import ImageRef

MEDIA_URL_PREFIX = "/media/"
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_EDGE = 1600
# Decoded size is ~4 bytes per pixel, so this caps one decode at ~100 MB (decompression bomb guard).
MAX_PIXELS = 25_000_000
WEBP_QUALITY = 85


@dataclass(frozen=True)
class OptimizedImage:
    data: bytes
    width: int
    height: int


def _encode(img: Image.Image, *, lossless: bool) -> bytes:
    out = io.BytesIO()
    img.save(out, "WEBP", quality=WEBP_QUALITY, lossless=lossless)
    return out.getvalue()


def optimize(data: bytes) -> OptimizedImage | None:
    """WebP bytes (long edge <= MAX_EDGE) of a PNG/JPEG/WebP; None when unreadable or too large.

    A WebP already within the size limit is returned unchanged (same `data` object). PNG keeps
    the smaller of lossy and lossless output so flat text such as size charts stays sharp.
    shortcut: an animated WebP wider than MAX_EDGE keeps only its first frame.
    """
    try:
        with Image.open(io.BytesIO(data), formats=("PNG", "JPEG", "WEBP")) as img:
            if img.width * img.height > MAX_PIXELS:
                return None
            source_format = img.format
            if source_format == "WEBP" and max(img.size) <= MAX_EDGE:
                img.load()
                return OptimizedImage(data, img.width, img.height)
            fixed = ImageOps.exif_transpose(img)
            fixed = fixed.convert("RGBA" if fixed.has_transparency_data else "RGB")
            fixed.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
            encoded = _encode(fixed, lossless=False)
            if source_format == "PNG":
                encoded = min(encoded, _encode(fixed, lossless=True), key=len)
            return OptimizedImage(encoded, fixed.width, fixed.height)
    except (OSError, SyntaxError, ValueError, Image.DecompressionBombError):
        return None


async def find_image(
    session: AsyncSession, school_id: uuid.UUID, product_id: uuid.UUID, gender: str, colour: str
) -> ImageRef | None:
    """Image of a product for a school, gender and colour; None means show the placeholder."""
    image = await session.scalar(
        select(ProductImage).where(
            ProductImage.school_id == school_id,
            ProductImage.product_id == product_id,
            ProductImage.gender == gender,
            ProductImage.colour == colour,
            ProductImage.deleted_at.is_(None),
        )
    )
    if image is None:
        return None
    return ImageRef(url=MEDIA_URL_PREFIX + image.path, width=image.width, height=image.height)
