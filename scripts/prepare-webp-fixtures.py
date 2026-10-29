#!/usr/bin/env python3
"""Generate procedural WebP QA inputs in ignored .qa/webp, never user artwork.

Run with the local Pillow installation; no network or additional package install
is needed. The manifest records the actual Pillow/libwebp encoder versions and
file hashes. Browser acceptance compares that browser's decoded file, not this
encoder's pre-compression pixels or Pillow's color conversion.
"""

from __future__ import annotations

import hashlib
import json
import math
import struct
from pathlib import Path

import PIL
from PIL import Image, features


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / ".qa" / "webp"


def riff_chunk(kind: bytes, payload: bytes) -> bytes:
    return kind + struct.pack("<I", len(payload)) + payload + (b"\0" if len(payload) & 1 else b"")


def riff(*chunks: bytes) -> bytes:
    payload = b"WEBP" + b"".join(chunks)
    return b"RIFF" + struct.pack("<I", len(payload)) + payload


def lossless_header(width: int, height: int) -> bytes:
    # Complete VP8L signature/dimension header, deliberately no entropy stream.
    return b"\x2f" + struct.pack("<I", (width - 1) | ((height - 1) << 14))


def chunk_names(data: bytes) -> list[str]:
    output: list[str] = []
    offset = 12
    while offset + 8 <= len(data):
        output.append(data[offset : offset + 4].decode("ascii"))
        length = struct.unpack_from("<I", data, offset + 4)[0]
        offset += 8 + length + (length & 1)
    return output


def color_image(alpha: bool) -> Image.Image:
    image = Image.new("RGBA", (32, 24))
    levels = (0, 33, 96, 177, 255)
    image.putdata([
        ((x * 29 + y * 7) % 256, (x * 11 + y * 31) % 256, (x * 17 + y * 13) % 256,
         levels[(x // 4 + y // 3) % len(levels)] if alpha else 255)
        for y in range(24) for x in range(32)
    ])
    return image


def monochrome_icon() -> Image.Image:
    """A ring, separate round-ended line and island, sampled at 8x per axis."""
    size = 96
    samples = 8
    rgba = bytearray(size * size * 4)
    ax, ay, bx, by, radius = 61.0, 20.0, 79.0, 73.0, 4.0
    vx, vy = bx - ax, by - ay
    length_squared = vx * vx + vy * vy
    for y in range(size):
        for x in range(size):
            covered = 0
            for sy in range(samples):
                py = y + (sy + 0.5) / samples
                for sx in range(samples):
                    px = x + (sx + 0.5) / samples
                    ring_distance = (px - 29.0) ** 2 + (py - 34.0) ** 2
                    projection = max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / length_squared))
                    line_distance = (px - ax - projection * vx) ** 2 + (py - ay - projection * vy) ** 2
                    island_distance = (px - 25.0) ** 2 + (py - 77.0) ** 2
                    covered += 14.0 ** 2 <= ring_distance <= 20.0 ** 2 or line_distance <= radius ** 2 or island_distance <= 5.0 ** 2
            rgba[(y * size + x) * 4 + 3] = math.floor(255 * covered / (samples * samples) + 0.5)
    return Image.frombytes("RGBA", (size, size), bytes(rgba))


def main() -> None:
    if not features.check("webp"):
        raise SystemExit("This local Pillow installation has no WebP encoder.")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    entries: list[dict[str, object]] = []

    def record(name: str, *, kind: str, width: int, height: int,
               lossless: bool | None = None, alpha: bool = False, source: Image.Image | None = None) -> None:
        data = (OUTPUT / name).read_bytes()
        entry: dict[str, object] = {
            "name": name, "kind": kind, "width": width, "height": height,
            "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
            "lossless": lossless, "alpha": alpha,
        }
        if name.endswith(".webp") and kind != "invalid-container":
            entry["chunks"] = chunk_names(data)
        if source is not None:
            entry["sourceRgbaSha256"] = hashlib.sha256(source.convert("RGBA").tobytes()).hexdigest()
        entries.append(entry)

    for alpha in (False, True):
        source = color_image(alpha)
        for lossless in (True, False):
            name = f"{'alpha' if alpha else 'opaque'}-{'lossless' if lossless else 'lossy'}.webp"
            source.save(OUTPUT / name, "WEBP", lossless=lossless, quality=58 if not lossless else 100,
                        method=6, exact=True)
            with Image.open(OUTPUT / name) as decoded:
                decoded.load()
                assert decoded.size == source.size
                if lossless:
                    assert decoded.convert("RGBA").tobytes() == source.tobytes(), "Lossless fixture changed its source pixels"
            record(name, kind="static", width=32, height=24, lossless=lossless, alpha=alpha, source=source)

    icon = monochrome_icon()
    icon.save(OUTPUT / "monochrome-96.webp", "WEBP", lossless=True, quality=100, method=6, exact=True)
    icon.save(OUTPUT / "monochrome-96.png", "PNG")
    record("monochrome-96.webp", kind="static", width=96, height=96, lossless=True, alpha=True, source=icon)
    record("monochrome-96.png", kind="png-control", width=96, height=96, alpha=True, source=icon)

    first = color_image(False)
    second = Image.new("RGBA", first.size, (19, 170, 240, 255))
    first.save(OUTPUT / "animated.webp", "WEBP", save_all=True, append_images=[second],
               duration=[120, 180], loop=0, lossless=True, method=6, exact=True)
    with Image.open(OUTPUT / "animated.webp") as animation:
        assert animation.n_frames == 2
    record("animated.webp", kind="animated", width=32, height=24, lossless=True)

    # Prior control: a header-only VP8L was rejected by Pillow 12.3.0 but
    # unexpectedly decoded in Chrome 155 (the first browser run passed 20/21).
    # Keep the negative assertion: this VP8 keyframe now declares a 64-byte
    # first compressed partition while supplying none. RIFF/chunk bounds,
    # keyframe signature and native dimensions remain structurally readable.
    frame_tag = ((64 << 5) | 0x10).to_bytes(3, "little")
    keyframe_header = frame_tag + b"\x9d\x01\x2a" + struct.pack("<HH", 32, 24)
    invalid_entropy = riff(riff_chunk(b"VP8 ", keyframe_header))
    (OUTPUT / "invalid-entropy.webp").write_bytes(invalid_entropy)
    try:
        with Image.open(OUTPUT / "invalid-entropy.webp") as invalid_image:
            invalid_image.load()
    except OSError:
        pass
    else:
        raise AssertionError("The deliberately missing entropy stream unexpectedly decoded")
    record("invalid-entropy.webp", kind="invalid-entropy", width=32, height=24, lossless=False)

    (OUTPUT / "oversized.webp").write_bytes(riff(riff_chunk(b"VP8L", lossless_header(4097, 1))))
    record("oversized.webp", kind="oversized", width=4097, height=1, lossless=True)
    invalid_container = bytearray(invalid_entropy)
    struct.pack_into("<I", invalid_container, 4, len(invalid_container) + 32)
    (OUTPUT / "invalid-riff.webp").write_bytes(invalid_container)
    record("invalid-riff.webp", kind="invalid-container", width=32, height=24, lossless=False)

    manifest = {
        "purpose": "Procedural development-only WebP inputs; no user artwork.",
        "generator": "scripts/prepare-webp-fixtures.py",
        "pillow": PIL.__version__, "libwebp": features.version("webp"),
        "reference": "The browser's decoded native RGBA8 sRGB pixels, not pre-compression or Pillow pixels.",
        "files": entries,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"directory": str(OUTPUT), "pillow": PIL.__version__, "libwebp": features.version("webp"),
                      "files": len(entries), "manifest": str(OUTPUT / "manifest.json")}, indent=2))


if __name__ == "__main__":
    main()
