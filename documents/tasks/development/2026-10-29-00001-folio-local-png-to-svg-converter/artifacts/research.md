# PNG-to-SVG fidelity research

Research date: 2026-10-29. Scope: browser-local static PNG conversion and verification. No repository version or dependency assumptions were made; root owns source inspection. This is read-only research, not an implementation or test result.

## Recommended decision

Use the browser's native PNG decoder and an explicitly sRGB, transparent 2D canvas to establish the source RGBA8 reference. Construct non-overlapping, integer-aligned rectangles from visible pixels. Merge same-RGBA horizontal runs, then extend a rectangle into the next row only when the new run has identical x, width and RGBA. Serialize full `alpha / 255` precision, never rounded percentages. Render the completed SVG through an image element into a separate, identically configured canvas at source width × height, then count exact differing pixels.

The fidelity claim is about the decoded, browser-rendered reference at native size, in the tested browser and sRGB. It is not byte preservation of the PNG's original color samples or a cross-browser/color-profile guarantee. Preserve the original PNG byte-for-byte for embedded mode. SVG geometry remains pixel-grid artwork at large zoom.

## Verified facts and implications

### Canvas and alpha — high confidence

The HTML Standard (updated 26 October 2026) requires 2D canvas output bitmaps to use premultiplied alpha; conversion to/from unpremultiplied values is lossy for partially transparent colors. `ImageData` exposes channel values and a color space. Consequently, generated geometry alone cannot prove a match: both images must be rasterized and compared. Use the PNG's canvas readback as reference and generate from those same RGBA values. Comparison is strict: a pixel differs if alpha differs, or if either alpha is nonzero and any RGB channel differs. Ignore RGB only when both alpha values are zero. Never hide low-alpha differences with thresholds.

Sources:
- https://html.spec.whatwg.org/multipage/canvas.html#premultiplied-alpha-and-the-2d-rendering-context
- https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#the-imagedata-interface

`createImageBitmap` defaults for color-space conversion and premultiplication are implementation-specific. Its `colorSpaceConversion: "none"` ignores embedded profiles; choosing that merely to obtain raw sample values can make the reference disagree with the displayed PNG. Do not adopt it blindly. `ImageBitmap.close()` releases the bitmap's resources.

Source: https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#the-imagebitmap-interface

### PNG format — high confidence

The PNG Third Edition Recommendation is dated 24 June 2025. Indexed PNGs use PLTE; tRNS can supply per-palette alpha including partial transparency, and omitted alpha entries default opaque. Embedded iCCP information describes source color space. IHDR supplies the raster dimensions. acTL identifies animated PNG, for which a single static render cannot verify animation. Detect APNG and report unsupported static conversion rather than implying complete fidelity. PNG also permits eXIf; detect any source/browser dimension disagreement before drawing and do not silently stretch an orientation-transformed decode.

Source: https://www.w3.org/TR/png/

### SVG rasterization — high confidence

SVG `shape-rendering="crispEdges"` is a rendering hint, not an accuracy guarantee. Use it on axis-aligned, integer-positioned, stroke-free geometry, but still verify the result. Keep root `width`, `height`, and `viewBox="0 0 W H"` explicit. `fill-opacity` controls each fill and should use the exact normalized alpha rather than a rounded approximation. SVG `image` embeds another resource; using an original `data:image/png;base64,...` payload is a bitmap wrapper, not editable vector art.

Sources:
- https://www.w3.org/TR/SVG/painting#ShapeRenderingProperty
- https://www.w3.org/TR/SVG/latest/painting.html#FillOpacity
- https://www.w3.org/TR/SVG2/embedded.html#ImageElement
- https://www.w3.org/TR/SVG2/coords.html

## Implementation proposals and tradeoffs

1. Validate signature and IHDR width/height before decoding or allocating canvas buffers. Use explicit per-file byte/pixel/side limits to avoid oversized allocations. Limit vector rectangle count and estimated serialized size before building a massive DOM/string. These budgets are product choices and need measured validation, not claims of browser hard limits.
2. Process a batch sequentially. Keep geometry work in a worker or use bounded cooperative chunks so import/removal/cancellation remains responsive. Release temporary canvases, bitmaps and object URLs, including error and cancellation paths.
3. When vector complexity exceeds a limit, retain the item with a clear explanation and offer the embedded mode. Do not silently relabel a bitmap as vectors. If any native rasterization fails, show verification unavailable/failed, never a zero-difference badge.
4. Compare source and result canvases at integer native bitmap sizes with no DPR multiplication, CSS scaling, background fill, crop, normalization or smoothing operation in the comparison. Preview zoom and checkerboard backgrounds are presentation only.
5. Keep generation independent from verification. Verify the actual serialized SVG that is downloaded, not an in-memory rectangle reconstruction. Error handling must distinguish conversion error, rendering error and nonzero pixel difference.
6. Use local Blob/object URLs for previews and downloads. Render generated SVG as an image, not unsanitized inline HTML. Embed only generated numeric geometry or base64 original PNG bytes; avoid unescaped source filenames inside SVG markup. No upload endpoint or conversion-time network dependency.
7. For ZIP entries, use safe flat basenames: remove directory separators/control characters and unsafe trailing characters, normalize Unicode for collision tracking, and reserve names case-insensitively. Use deterministic suffixes (`icon.svg`, `icon (2).svg`) across the whole batch, including already-suffixed inputs. Avoid Windows device names and prototype-key traps by using Map/Set or safe library APIs. Keep human source names in the UI as text.
8. Preserve the source's dimensions and transparency. Do not quantize colors, apply color-distance merging, smooth edges, trace curves, resize or composite onto a background. Omit alpha-zero shapes; this discards invisible RGB only.

## Acceptance cases

| Case | Decisive assertion |
| --- | --- |
| Opaque solid rectangle | One rectangle after merging; native width/height correct; actual SVG render has zero differences. |
| Multiple adjacent colors | Same-color regions merge without overlapping different colors; zero rendered differences. |
| Fully transparent PNG | Empty visible geometry with original viewport; zero visible differences. |
| Partial alpha sweep | Test alpha 1–254 with nontrivial RGB values; preserve exact alpha and report actual comparison result. |
| Antialiased circle/diagonal | Retain edge pixels including low alpha; native rendered comparison is decisive. |
| Real indexed PNG | Use fixture containing PLTE + tRNS with fully transparent, partial-alpha and opaque entries; canvas-generated PNG alone is not palette coverage. |
| Merge boundary patterns | Narrow/wide neighboring runs, holes, disconnected shapes and row breaks produce no overlap and no lost pixels. |
| Comparator negative test | A known single visible-pixel alteration produces count 1 and no verified badge; alpha-only changes count too. |
| Invisible RGB | Different RGB values with both alpha=0 count as zero visible difference. |
| Embedded mode | Decode data URI and compare original byte sequence, then rasterize actual SVG and compare pixels; label bitmap artwork. |
| Collision batch | Duplicate, case-only, already-suffixed and Unicode-equivalent names yield unique safe flat ZIP entries and matching individual names. |
| Resource errors | Corrupt PNG, oversize dimensions, vector complexity limit, cancelled job and image-render error surface clear states and never a verified badge. |
| Local privacy | Once app assets load, importing, converting, previewing, switching modes and ZIP downloading produce no outbound file requests; test offline behavior. |
| Existing app | Navigation preserves the archive workspace and its data/selection while converter jobs keep independent state. |

## Remaining limits

No browser runs or package versions were inspected by this research task. Exact alpha and ICC behavior needs real runtime evidence. Chromium-only tests must be reported as Chromium-only; avoid claiming Safari/Firefox parity. No third-party implementation source was copied and no package adoption is proposed; license review is therefore not applicable at this stage.
