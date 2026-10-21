"""Image sniffing by magic bytes; dimensions are read from the file header only."""

import struct
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.catalog.models import ProductImage
from app.features.catalog.schemas import ImageRef

MEDIA_URL_PREFIX = "/media/"
MAX_IMAGE_BYTES = 5 * 1024 * 1024
_JPEG_SOF = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}


@dataclass(frozen=True)
class ImageInfo:
    ext: str
    width: int
    height: int


def _png(data: bytes) -> ImageInfo | None:
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR" or len(data) < 24:
        return None
    width, height = struct.unpack(">II", data[16:24])
    return ImageInfo("png", width, height)


def _jpeg(data: bytes) -> ImageInfo | None:
    if data[:3] != b"\xff\xd8\xff":
        return None
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            return None
        marker = data[i + 1]
        if marker == 0xFF:
            i += 1
            continue
        if marker in _JPEG_SOF:
            height, width = struct.unpack(">HH", data[i + 5 : i + 9])
            return ImageInfo("jpg", width, height)
        if marker == 0xD8 or 0xD0 <= marker <= 0xD7 or marker == 0x01:
            i += 2
            continue
        i += 2 + struct.unpack(">H", data[i + 2 : i + 4])[0]
    return None


def _webp(data: bytes) -> ImageInfo | None:
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP" or len(data) < 30:
        return None
    kind = data[12:16]
    if kind == b"VP8 " and data[23:26] == b"\x9d\x01\x2a":
        width, height = struct.unpack("<HH", data[26:30])
        return ImageInfo("webp", width & 0x3FFF, height & 0x3FFF)
    if kind == b"VP8L" and data[20] == 0x2F:
        bits = int.from_bytes(data[21:25], "little")
        return ImageInfo("webp", (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1)
    if kind == b"VP8X":
        width = int.from_bytes(data[24:27], "little") + 1
        height = int.from_bytes(data[27:30], "little") + 1
        return ImageInfo("webp", width, height)
    return None


def sniff(data: bytes) -> ImageInfo | None:
    """Return type and size when `data` is a WebP, JPEG or PNG with a readable header."""
    info = _png(data) or _jpeg(data) or _webp(data)
    if info is None or info.width <= 0 or info.height <= 0:
        return None
    return info


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
