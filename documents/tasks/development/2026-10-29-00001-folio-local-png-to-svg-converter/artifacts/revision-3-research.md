# Revision 3 research — smooth local PNG-to-SVG conversion

**Research date:** 2026-10-29 UTC. **Stage:** GRS, independent researcher. **Status:** decision-ready research; runtime adoption remains subject to the reviewed plan and the browser experiment below.

## Recommended decision

Keep the existing native-dimension **Pixel vectors** and **Embedded PNG** representations, and add an explicitly approximate **Smooth curves** representation. For the new mode, the best deployable candidates found in this investigation are **vtracer-browser 0.0.3** for fully opaque images and **imagetracerjs 1.2.6** for images with any transparency. Both can run entirely on the user's device without model weights or a server. This is a recommendation based on source inspection and packaging evidence, not a completed quality benchmark.

The important adoption gate is a small, antialiased, transparent silhouette with holes. Alpha-aware tracing alone does not establish attractive enlarged contours: ImageTracer can turn antialiasing into multiple translucent bands. Test that case before claiming improved quality. If the baseline fails it, a narrowly detected single-color silhouette can be traced from its normalized-alpha contour, with the original foreground color and interior opacity restored. That route deliberately reconstructs coverage and is approximate. It must not silently process general shadows or translucent multicolor artwork as a silhouette.

Do not adopt the public `@buzz-dee/vtrace` API for multicolor output: despite its advertised color options, the inspected implementation joins all upstream paths into one path and emits one fill. Do not use raw VTracer directly on arbitrary RGBA images: the current writer discards per-shape alpha. Do not add cloud vectorization or a GPU model to this browser-only feature.

## Scope and evidence quality

This investigation read primary repositories, published package archives, official model cards, papers, and the current Folio source. Searches included current results through October 2026. No user PNGs, filenames, screenshots, collection data, or other private assets were retrieved or uploaded. No app dependency was installed; no source implementation, build, benchmark, or browser execution was performed by this researcher.

With the parent's explicit authorization, `npm pack --ignore-scripts` downloaded two public package archives into `/tmp/folio-tracer-research` for static inspection. The package scripts were not executed. Published npm timestamps and integrity values were read separately. Temporary archives are not repository deliverables.

Facts below are distinguished from engineering proposals. A paper's benchmark is evidence about that paper's datasets and settings, not evidence about Folio's icons, current browsers, or a newer tracer version. Source-level compatibility is also not a successful production bundle test.

## Why the current result is pixelated

The inspected implementation creates integer rectangles inside `shape-rendering="crispEdges"`. Its preview adds `image-rendering:pixelated` to both source and SVG at every explicit zoom setting. Those choices reproduce the pixel grid. A native zero-difference check measures exactly the requirement it claims; it does not measure recovery of a continuous outline.

Relevant local sources are `src/png-svg.ts` (`createPixelSvg`, `compareVisiblePixels`), `src/components/PngSvgWorkspace.tsx` (the two preview images), and `src/components/png-svg.css` (`.pixel-zoom`). The independent engine agent also reported that the source reference and serialized-SVG rasterization are separate paths; this report does not replace that review or the parent's browser evidence.

Many different curves can produce the same finite pixel samples. Consequently, arbitrary PNGs do not determine a unique original curve. Fitting smoother geometry adds assumptions about intended edges, corners, colors, and topology. This is why enlarged visual quality and exact native samples need separate labels and measurements.

### Preserve the exact mode's meaning

Retain the exact visible-RGBA comparison and zero-only success badge. Keep native dimensions, source decoding, alpha, and profile caveats. Pixel mode may gain smaller serialization, for example grouping disjoint same-color rectangles into path subpaths, but that changes file size rather than recovering curves. Such a serializer would still need an actual browser raster comparison; it is not necessary to solve this revision's visual concern.

Canvas premultiplication can lose low-alpha RGB information. The correct reference remains the browser-decoded native RGBA buffer used for the comparison, not an untested promise about every raw PNG sample or color profile. The standard explicitly describes lossy conversion between premultiplied and non-premultiplied alpha. [HTML canvas standard](https://html.spec.whatwg.org/multipage/canvas.html#premultiplied-alpha-and-the-2d-rendering-context)

## Classical engines and browser packages

| Engine/package inspected | Version/date evidence | License evidence | Browser fit | Decision |
| --- | --- | --- | --- | --- |
| VTracer core | `1.0.0-alpha.4`, released 2026-08-29; tag commit `2500df76b5aea0ac22d15296b22722442f825c5b` | Repository MIT; published wrapper/core metadata also offers MIT OR Apache-2.0 | Rust core is WASM-compatible; official npm entry is Node-oriented | Best modern color-tracer candidate, with alpha restrictions |
| `vtracer-browser` | `0.0.3`, npm published 2026-09-15T02:59:58.510Z; source snapshot `2c137d3b0aa7a0c1f1f27b81981c611803e57597` | MIT wrapper; upstream dependency notices required | Module worker, raw RGBA entry, shipped WASM; no native toolchain for consumers | Preferred VTracer integration candidate |
| `imagetracerjs` | `1.2.6`, npm published 2020-05-18T18:50:57.404Z | Unlicense; license file inspected | Pure JavaScript; synchronous pixel API usable inside our worker | Preferred alpha-aware baseline; quality gate required |
| `@buzz-dee/vtrace` | `2.0.0-0` published package; inspected source `ac663dfe5624c1740ff8bf37247d7a1d0f810043` | MIT wrapper | Embedded WASM, no runtime asset lookup | Reject public API for multicolor: combines paths into one fill |
| `@visioncortex/vtracer` | `1.0.0-alpha.4` | MIT OR Apache-2.0 package metadata | Build command targets Node; wrapper uses file APIs | Do not assume browser compatibility from “WASM” |
| `@neplex/vectorizer` | `0.1.0` inspected | MIT repository | WASI threads; official browser example needs SharedArrayBuffer and isolation headers | Unnecessary hosting/runtime complexity for this app |
| Potrace / `esm-potrace-wasm` | Potrace 1.16, 2019-09-17; npm indexed wrapper 0.5.1, repository package currently 0.5.0 | Potrace GPL-2.0-or-later; wrapper declares GPL-2.0 | Real browser WASM; principally binary tracing, color via layering/posterization | Technically relevant but not chosen; licensing and color/alpha adaptation add work |
| `jsscheller/vtracer-wasm` | 0.1.0 | Published package metadata lacks license field; upstream licenses alone do not resolve wrapper provenance | Older wrapper, minimal API documentation | Prefer the better-audited current wrapper |
| RasterTrace application | Current source uses VTracer 1.0.0-alpha.4 | MIT app | Demonstrates worker/WASM local tracing and reproducible packaging | Useful implementation reference, not a dependency or alpha-preservation proof |

### What changed in VTracer recently

The 2026 1.0 alpha series adds a stage-based pipeline, watershed segmentation, shared-boundary cutout construction, curve simplification, palette fitting, and output optimization. The alpha.4 release relaxes the watershed detail ceiling and updates visioncortex to 0.9.3. These are meaningful new options, but the release remains an alpha, and more segmentation can increase complexity dramatically. [Official releases](https://github.com/visioncortex/vtracer/releases) · [Changelog](https://github.com/visioncortex/vtracer/blob/1.0.0-alpha.4/CHANGELOG.md)

Shared-boundary cutout is attractive for adjacent colored regions because neighbors use the same fitted boundary rather than independently fitted outlines. Its topology does not itself certify seam-free rasterization in every browser, and it does not fix missing alpha. [Mosaic implementation](https://github.com/visioncortex/vtracer/blob/1.0.0-alpha.4/crates/vtracer/src/mosaic.rs)

### VTracer's actual alpha behavior

The current SVG writer turns `Paint::Solid(c)` into `c.to_hex_string()`. In visioncortex that function emits six-digit RGB, not alpha; there is no output `fill-opacity` in this writer. Thus accepting an RGBA buffer is not equivalent to preserving RGBA. [Pinned SVG writer](https://github.com/visioncortex/vtracer/blob/1.0.0-alpha.4/crates/vtracer/src/svg.rs) · [Color representation](https://github.com/visioncortex/visioncortex/blob/master/src/color.rs)

The color-cluster frontend recolors fully transparent pixels to a discardable key only when its sampled-transparency heuristic decides keying is needed. Sparse or interior transparency is therefore another case requiring testing. Partial alpha is not handled by this keying mechanism. The watershed path creates RGB region colors. Conservative initial routing should send **every PNG with any alpha below 255** to the alpha-aware route, rather than trying to infer that VTracer's transparency shortcut is sufficient. [Keying](https://github.com/visioncortex/vtracer/blob/1.0.0-alpha.4/crates/vtracer/src/frontend/keying.rs) · [Color-cluster frontend](https://github.com/visioncortex/vtracer/blob/1.0.0-alpha.4/crates/vtracer/src/frontend/color_cluster.rs) · [Watershed frontend](https://github.com/visioncortex/vtracer/blob/1.0.0-alpha.4/crates/vtracer/src/frontend/watershed.rs)

RasterTrace's own preprocessing describes binary alpha. That is a deliberate quality/complexity tradeoff for tracing, not preservation of arbitrary soft shadows or partially transparent fills. Its source is valuable as a browser packaging example, but its output claims must not be transferred to Folio. [RasterTrace README](https://github.com/bradsec/rastertrace/blob/main/README.md) · [Wrapper crate](https://github.com/bradsec/rastertrace/blob/main/wasm/Cargo.toml)

### Preferred modern browser wrapper

`vtracer-browser` exposes `convertPixels`, returning the upstream SVG directly. The source copies the caller's pixels before transfer, validates dimensions/options, reports progress, and terminates/rejects pending tasks when its worker is stopped. Rust calls `pipeline.to_svg` or the progress-enabled equivalent. Unlike the rejected wrapper, there is no one-fill export transformation. [API source](https://github.com/zxdstyle/vtracer-browser/blob/2c137d3b0aa7a0c1f1f27b81981c611803e57597/src/index.ts) · [Rust binding](https://github.com/zxdstyle/vtracer-browser/blob/2c137d3b0aa7a0c1f1f27b81981c611803e57597/crates/vtracer-wasm/src/lib.rs)

Its published archive contains 8,811 bytes of entry JavaScript, 17,187 bytes of worker JavaScript, and 237,611 bytes of WASM. The three assets resolve relative to one another. The worker fetches the local WASM; it does not need a CDN or source-image upload. Installing the prebuilt package does not require Rust. Rebuilding upstream does require a Rust WASM toolchain, which is absent from the current environment. [Package](https://www.npmjs.com/package/vtracer-browser) · [Source manifest](https://github.com/zxdstyle/vtracer-browser/blob/2c137d3b0aa7a0c1f1f27b81981c611803e57597/package.json) · [Loader](https://github.com/zxdstyle/vtracer-browser/blob/2c137d3b0aa7a0c1f1f27b81981c611803e57597/src/wasm.ts)

**Integration proposal:** use the already validated browser RGBA via `convertPixels`, not the package's separate decode/rescale route. Bundle/copy the three package artifacts together during build, or explicitly rewrite their URLs through the existing build tooling. An `optimizeDeps.exclude` change addresses development prebundling only; verify production URLs and the deployed base path. No broad repository privacy exception is needed: package artifacts remain in ignored dependencies/build output, with exact versions and lockfile integrity committed. Preserve license notices in distributed output. [Bundler guidance](https://github.com/zxdstyle/vtracer-browser/blob/2c137d3b0aa7a0c1f1f27b81981c611803e57597/README.md) · [MIT license](https://github.com/zxdstyle/vtracer-browser/blob/2c137d3b0aa7a0c1f1f27b81981c611803e57597/LICENSE)

The wrapper's parameter limits are far too permissive to substitute for Folio's budgets. Apply local pixel/output/path/iteration limits, one active job, timeout, and hard worker termination. A synchronous WASM call cannot process a later cancellation message while it is computing. Termination is the reliable interrupt; recreate the worker afterward. This is an integration inference from the worker source, not a measured latency claim. [Worker](https://github.com/zxdstyle/vtracer-browser/blob/2c137d3b0aa7a0c1f1f27b81981c611803e57597/src/worker.ts)

### ImageTracer's useful behavior and traps

The published 1.2.6 source is 47,118 bytes. It includes alpha in palette-distance calculation, averages alpha during quantization, and emits per-path opacity as `a/255`. That is suitable for an approximate alpha-aware baseline, but palette clustering and fitted boundaries can still change transparency. Its synchronous `imagedataToSVG`/`imagedataToTracedata` API avoids image URL loading and DOM insertion helpers. [Official repository/API](https://github.com/jankovicsandras/imagetracerjs) · [Source](https://github.com/jankovicsandras/imagetracerjs/blob/cb0c84a309df5e75614d3b5166cdc77a56f12a98/imagetracer_v1.2.6.js) · [License](https://github.com/jankovicsandras/imagetracerjs/blob/cb0c84a309df5e75614d3b5166cdc77a56f12a98/LICENSE)

Defaults are not appropriate for preserving small icons: `pathomit:8` can remove details, `strokewidth:1` expands shapes and changes partially transparent edges, and 16 palette colors can merge important alpha/color values. Proposed initial settings are zero path omission, zero stroke width, no blur, deterministic sampling or a bounded explicit palette, `mincolorratio:0`, and three decimal places. Tune line/curve tolerances using the experiment rather than assuming “detailed” is always better. Fully transparent pixels should be normalized to one canonical hidden RGB before quantization; preserve the original comparison buffer separately.

The random palette sampling and palette-regeneration branches must remain disabled if reproducible output is expected. Explicit palettes with a fixed quantization pass are an alternative for low-color images, but retaining every antialias alpha value can produce many bands and excessive work. Reserve full transparency deliberately and test small islands missed by regular sampling. The inspected npm source differs slightly from today's GitHub file, so tests must exercise the **locked published package**, not a separately downloaded moving branch. These are source-informed implementation proposals, not claims of verified results.

### Rejected or secondary integrations

`@buzz-dee/vtrace` is attractive because it embeds its WASM into JavaScript. However, its public exporter extracts every path's `d`, combines them, and emits a single foreground fill with even-odd filling. Color options in its constructor do not make that public output multicolor. Its low-level raw wrapper is not part of the public package exports. Using private internals would add a fork/vendoring obligation without solving upstream alpha loss. [Pinned exporter](https://github.com/BuZZ-dEE/vtrace/blob/ac663dfe5624c1740ff8bf37247d7a1d0f810043/src/vtrace.ts) · [Public exports](https://github.com/BuZZ-dEE/vtrace/blob/ac663dfe5624c1740ff8bf37247d7a1d0f810043/src/index.ts)

The official `@visioncortex/vtracer` package is explicitly built with `wasm-pack --target nodejs`; the official webapp is a different, DOM-connected crate. Neither should be treated as a direct worker package. [Node manifest](https://github.com/visioncortex/vtracer/blob/1.0.0-alpha.4/nodejs/package.json) · [Webapp manifest](https://github.com/visioncortex/vtracer/blob/1.0.0-alpha.4/webapp/Cargo.toml)

Neplex's browser example is genuine, but its WASI/thread route requires isolation headers and SharedArrayBuffer. That is an avoidable deployment constraint for this app; its inspected core also uses visioncortex 0.8.10 rather than the selected 0.9.3 framework. [Official package](https://github.com/neplextech/vectorizer) · [Cargo manifest](https://github.com/neplextech/vectorizer/blob/main/Cargo.toml) · [Official browser example](https://github.com/twlite/vectorizer-playground)

Potrace remains useful for binary silhouettes, with direct browser WASM available. The core official license is GPL version 2 or later; the ESM wrapper declares GPL-2.0, and a separate commercial licensing route exists upstream. Do not mistake a permissively licensed surrounding UI for permission to redistribute its engine under that UI's license. This report records the actual licenses and makes no legal compatibility determination. There is no need to introduce that licensing path when permissive candidates satisfy the current implementation experiment. [Official Potrace](https://potrace.sourceforge.net/) · [ESM wrapper](https://github.com/tomayac/esm-potrace-wasm) · [Wrapper manifest](https://github.com/tomayac/esm-potrace-wasm/blob/main/package.json)

## Current neural and optimization research

These approaches make real progress in semantic structure and compact editable representations. They are not interchangeable with native pixel reproduction, and the inspected releases do not provide a production-ready offline-browser path for Folio.

| Approach | Verified availability and recency | Runtime/license facts | Relevance here |
| --- | --- | --- | --- |
| OmniSVG 1.1 | Official 4B and 8B weights updated 2025-12-02; inference code and later training code released | Python/PyTorch; official downloads 7.69 GB and 17.2 GB; reported GPU memory 17 GB and 26 GB; Apache-2.0 code/weights, separate noncommercial dataset license | Real downloadable model, but a GPU application project rather than a small browser dependency |
| StarVector | CVPR 2025; official 1B and 8B image-to-SVG checkpoints | Apache-2.0 code and model cards; Python/Transformers/CUDA examples | Semantic SVG primitives and diagrams; its own documentation excludes natural images/illustrations |
| LIVE | CVPR 2022; code available, no pretrained model needed for its per-image fitting loop | Apache-2.0; Python/PyTorch with compiled DiffVG; CUDA-oriented installation; default 500 optimization iterations per schedule | Important differentiable fitting baseline, not a shipped browser library |
| InternSVG | ICLR 2026; official 8B weights released 2026-01-28 | Apache-2.0 repository and model card; BF16 8B model; LMDeploy/PyTorch/GPU deployment examples | Unified SVG understanding/editing/generation; no inspected browser build |
| VFIG | March 2026 paper; official inference/training repository and released VFIG-4B checkpoint | Qwen3-VL-based 4B BF16; Python/Transformers; weight card CC-BY-4.0 and base-model conditions; example converts input to RGB | Real available model for scientific figures; not an alpha-preserving icon converter |
| VectorArk | May 2026 primary paper | Rounded-polygon representation, degradation training, candidate ranking; paper reports 1B model and 3–4 seconds on A100 for easy samples; no verified downloadable official code/weights found in this investigation | Promising current research, not an adoptable dependency claim |
| AmodalSVG | April 2026 paper | Semantic layer peeling and completion; inspected abstract says code will be released upon acceptance | Reconstructs occluded content; unsuitable as proof of unchanged visible-source fidelity |

### What the benchmarks actually establish

OmniSVG's own December 2025 paper table reports VTracer with higher SSIM and lower MSE than OmniSVG on its icon and illustration image-to-SVG tasks, while OmniSVG uses shorter token sequences. For example, icon SSIM is 0.966 for VTracer and 0.950 for OmniSVG-4B; illustration SSIM is 0.966 versus 0.906. This supports evaluating reconstruction quality separately from semantic compactness. It does **not** establish that classical tracing wins every dataset, that this table used VTracer's 2026 release, or that its numbers apply to transparent PNGs. [OmniSVG paper, Table 2](https://arxiv.org/html/2504.06263v3)

StarVector's own SVG-Bench results favor its 8B model on several semantic DinoScore categories. A semantic embedding score can reward structural resemblance while overlooking small pixel/color/alpha errors; it cannot replace the app's RGBA check. [StarVector project](https://starvector.github.io/starvector/) · [Official code](https://github.com/joanrod/star-vector) · [1B model card](https://huggingface.co/starvector/starvector-1b-im2svg)

VectorArk explicitly studies robustness to unknown rasterization and degraded inputs, which is highly relevant to real icons. Its paper also discusses the tradeoff between smoothing irregularities and pixel-level scores on simple examples. Use it as evidence that better geometry priors matter, not as evidence that arbitrary exact smooth reconstruction has been solved. Some secondary summaries misstate its latency as 33–44 seconds; the inspected primary paper says **3–4 seconds** for easy examples on A100. [VectorArk paper](https://arxiv.org/html/2605.24398v1)

### Availability and privacy distinctions

OmniSVG, StarVector, InternSVG, and VFIG could run offline after local model/runtime setup on suitable machines. Therefore “AI requires uploading” would be incorrect. The obstacle for this app is the absence of a verified browser package and the model/runtime footprint. Their hosted demos would send images off device and are outside the authorized product boundary. No hosted demo was used.

Do not state that VFIG or InternSVG weights are unavailable: their official model pages were verified. Conversely, a paper or GitHub mention alone is not a released, licensed, working package. This investigation found no official browser/WebGPU build for the listed model pipelines; that is a bounded finding, not a claim that such a port is impossible.

Primary model sources: [OmniSVG code/runtime](https://github.com/OmniSVG/OmniSVG) · [OmniSVG 4B license/card](https://huggingface.co/OmniSVG/OmniSVG1.1_4B/blob/main/README.md) · [LIVE code](https://github.com/Picsart-AI-Research/LIVE-Layerwise-Image-Vectorization) · [LIVE paper](https://arxiv.org/abs/2206.04655) · [InternSVG code](https://github.com/hmwang2002/InternSVG) · [InternSVG weights/license](https://huggingface.co/InternSVG/InternSVG-8B) · [VFIG code](https://github.com/RAIVNLab/VFig) · [VFIG weights/license](https://huggingface.co/XunmeiLiu/VFIG-4B) · [VFIG inference source](https://github.com/RAIVNLab/VFig/blob/main/inference/inference.py) · [AmodalSVG paper](https://arxiv.org/abs/2604.10940)

## Proposed implementation boundaries

1. **Keep representations explicit.** Store requested mode, actual engine/representation, settings, dimensions, output size, and verification outcome together. A smooth result is editable approximate geometry; a bitmap fallback stays labeled bitmap. A later Auto option must expose which representation was actually produced.
2. **Use one validated decode.** Preserve the original native RGBA reference. Preprocessing must work on a copy. No silent resize, flattening background, thresholding, quantization, blur, or generative enhancement in pixel mode.
3. **Treat smooth output as approximate.** Run the same strict native raster comparison and show the actual differing-pixel count. Never change the zero-difference test to a tolerance to make a smooth trace pass. Add an explanatory approximate-mode status instead of presenting all expected differences as a conversion failure.
4. **Preserve the source boundary.** Same-origin bundled worker/WASM assets only; no CDN, model download, analytics payload, server API, remote font, or original filename in network requests. No inline insertion of returned SVG markup into the app DOM. Normalize/allowlist generated SVG structure before use if any user-controlled strings are incorporated.
5. **Retain cancellation and budgets.** Keep the existing serial queue/job-generation guard. Smooth jobs need a stricter initial pixel/shape budget if the measured path cost is higher. Do not inherit the wrapper's enormous numeric maxima. Abort terminates the active worker and clears retained intermediates.
6. **Render a useful comparison.** Smooth SVG previews must use ordinary antialiasing and must not inherit pixelated CSS or `crispEdges`. Offer source pixel inspection separately from visual scaling. Align comparison dimensions and zoom transforms. A 4× interpolated PNG is not ground truth for an unknown original curve.
7. **Keep dependencies out of Git payloads.** Commit manifests, lockfile, integration source, notices, and generated-fixture code. Do not commit tarballs, WASM binaries, third-party demo PNGs, user art, generated SVGs, or screenshots. The existing privacy policy remains sufficient.

### Why not repair a smooth trace with RGBA rectangles on top?

For source-over compositing, `alpha_out = alpha_patch + alpha_base × (1 − alpha_patch)`. It follows that the resulting alpha cannot be smaller than the base alpha. Painting a partially transparent original pixel over an opaque traced edge cannot make the result partially transparent. Correcting it would require removing/masking the base first and replacing the pixel. That introduces grid-aligned cutouts/corrections and can undo the enlarged smoothness sought here.

A smooth color trace plus a separately traced vector alpha mask is a possible research direction, but it has additional luminance/alpha compositing, overlapping-layer, and renderer questions. It is not a proven exactness shortcut and is not recommended for this bounded revision.

### A narrowly detected silhouette route, only if the baseline fails

For a near-single-color source whose alpha mainly represents antialiased coverage, test tracing the normalized alpha boundary rather than separate opacity bands. Preserve the dominant foreground RGB and measured interior opacity; classify eligibility conservatively. Thresholding around half the interior opacity is an initial hypothesis for the experiment, not a universal correct contour. Keep tiny components and holes by disabling speckle removal. Inputs with multiple translucent colors, soft shadows, or no stable interior opacity should stay on the general alpha route or report unsupported smoothing.

The output can be one or more filled Bézier paths with holes, and the renderer generates new edge coverage. This produces real scalable geometry, but modifies native alpha samples and therefore remains approximate. A perfect curve can even have a worse strict differing-pixel count than many opacity bands; assess visual contour quality and sample accuracy separately.

## Bounded adoption experiment and acceptance gates

This section is a proposed plan input. None of these runtime gates has been executed by this researcher.

### Fixture set

Generate all fixtures from code. Include a 96×96 single-color antialiased silhouette with a curved hole; circles/ellipses at fractional positions; thin curved strokes and small islands; adjacent flat multicolor regions; a multicolor transparent icon; a uniform partially transparent fill; a soft alpha shadow/gradient; true PLTE+tRNS input; opaque gradients; and high-frequency/noise input. Keep the existing six PNG categories and all-alpha sweep for exact-mode regressions.

Use known synthetic SVG/analytic geometry as the high-resolution reference for some curve fixtures. Rasterize to source PNG at native size, then compare traced output against the original known geometry at 4× and 8×. This gives an actual controlled contour-quality target. Do not use private art or a resized unknown PNG as high-resolution truth.

### Gates

| Gate | Required evidence before adopting |
| --- | --- |
| Exact-mode regression | Existing positive zero-difference opaque/transparent/partial/AA/palette/multicolor cases still pass; deliberate one-pixel mismatch is still counted |
| Output identity | Native width/height/viewBox preserved; output contains real path/shape geometry; smooth mode includes no embedded raster or external references |
| Alpha/topology | Transparent backgrounds remain transparent; holes and separate small components survive; partial interior opacity and soft shadows are not turned opaque or flattened |
| Silhouette quality | At 400% the selected curve profile visibly removes staircase contours; on controlled ground-truth cases, enlarged contour error improves over pixel rectangles without losing holes/strokes |
| Multicolor correctness | VTracer route retains distinct fills; no one-color export regression; adjacent regions do not acquire visible gaps on tested backgrounds |
| Honesty | Strict native differing-pixel count comes from the final serialized SVG and is shown even when nonzero; only exact zero earns the verification badge |
| Production packaging | Production preview and deployed path load worker+WASM successfully; conversion works after those assets are loaded and network is disabled; no file/filename upload |
| Resource handling | Stop/clear/remove/retry/navigation during WASM load, trace, and verification produces no stale result, blocked UI, or retained abandoned worker; budgets reject hostile complexity |
| Browser coverage | Record actual browser/version/platform; run at least the available Chromium browser. Firefox/WebKit results are separate tests, not inferred support claims |

Measure wall time, output bytes, path/segment count, and cancellation behavior for small icons and the chosen upper bound. For quality, retain strict native RGBA counts, and optionally compute alpha-aware premultiplied error plus black/white composite error. Those supplementary scores explain severity; they do not replace zero equality. If a proposed profile loses a hole, erases a thin component, turns a translucent fill opaque, or worsens the actual motivating silhouette, revise the profile/route before shipping it as the improved option.

The initial VTracer profile should use full-color spline tracing, zero speckle removal for small icons, bounded iterations, conservative simplification, and sufficient coordinate precision. Avoid aggressive palette reduction by default. Compare stacked/cutout only if there is a specific seam or editability issue. A large parameter sweep is unnecessary until a measured failure justifies it.

## Provenance receipt

Published archives were read without installation or script execution:

| Artifact | Recorded value |
| --- | --- |
| `vtracer-browser@0.0.3` npm integrity | `sha512-dgqvxl9NpwA8OByM1GyulQGnC2tI4dJznLvZW9bBdDbuSpg/S5CujVjNgkAQl51cWcj4Vx/VVgb/bk6aTO5Emg==` |
| Tracer archive SHA-256 | `d6da81a6889442ac568ea86574bcf194edc9497b133b0221915dffb39ebf2525` |
| Published WASM SHA-256 | `4268d8c00ae604d34d41f0aa6470eb447c0b13635275340e0cdd66f950e2068e` |
| Published worker JS SHA-256 | `7fcad445c6b808798e6cfc425102cafe937ccc6051969aee18b31c26b7923303` |
| Published entry JS SHA-256 | `40d3fc0e8a2d2e15581f8c052d358bcd6e55f847f3165d5b29ea958e1b33465c` |
| `imagetracerjs@1.2.6` npm integrity | `sha512-LKJlnKmXFzDdh6IZtXTyBxXcCLTAkwgKYS+NMiPXiXVnlTLjQC8fq7U89laUSgHtypJB3TdMMDK4ecG5NI/Cgw==` |
| ImageTracer archive SHA-256 | `bf25c789f213869b8df1a577c2cada6a4c307ecf239857ee21150d0eeca80bab` |
| Published ImageTracer JS SHA-256 | `1f7e21062196c53f2565120fc0708eac197c8403ec1bea28b381056ea0c3fdb9` |

Primary registry locators: [vtracer-browser metadata](https://registry.npmjs.org/vtracer-browser) · [ImageTracer metadata](https://registry.npmjs.org/imagetracerjs). The archive/source hashes are observations of the retrieved artifacts, not a reproducible-build attestation. The VTracer wrapper's inspected Cargo.lock pins VTracer 1.0.0-alpha.4, visioncortex 0.9.3, and wasm-bindgen 0.2.128. [Pinned lockfile](https://github.com/zxdstyle/vtracer-browser/blob/2c137d3b0aa7a0c1f1f27b81981c611803e57597/crates/vtracer-wasm/Cargo.lock)

Local baseline hashes at research time:

- `src/png-svg.ts`: `e406285f9a947e8b9dec6a78d92b3a0c38d22d363404ad95311f7e87d2d45f3c`
- `src/png-svg-browser.ts`: `f13182d83269a4ccdc98b77b6285e24e4814eed86950ee7ef1b5d0e786f265e2`
- `src/components/PngSvgWorkspace.tsx`: `459a8a751b723df1a30ef9476cbeacebdc61b7a73704677d2d189fb91b0e42cd`
- `src/components/png-svg.css`: `4b77b724cf76b1408fbea85a7b7b67690060bfc2bf7371444f6b10aaf47c44f5`

## Remaining uncertainties

The candidates' visual quality on Folio's motivating silhouette, actual production bundler behavior, browser memory usage at proposed limits, and supported browser matrix remain unverified. The selected modern engine is pre-release and its browser wrapper is young. Those are concrete reasons for the bounded adoption experiment, exact dependency pins, and retained pixel/bitmap alternatives—not reasons to claim research has already established universal fidelity.
