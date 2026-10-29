# Revision 4 — bounded review of the built package

**Verdict: approved for the inspected packaging scope. No unresolved packaging finding.** Actual conversion through the production server and published Site remains a separate runtime gate owned by the coordinator.

Reviewer: independent application reviewer `/root/fidelity_research`. Review completed **2026-10-29 15:38 UTC**. This reviewer authored development-only collection checks and the tracer notice document, but did not author the application, tracing engines, asset plugin, or server packaging implementation.

## Scope and evidence boundary

Read-only inspection covered the existing `.sites-runtime/frontend-assets.json`, `dist/server/index.js`, their decoded assets, pinned installed package files, lockfile, and the small asset/server packaging sources. No build, package installation, browser operation, conversion, network request, server execution, or application edit was performed in this review. The only written file is this report.

Static JavaScript parsing inspected the built server object and module references without evaluating their code. The findings identify these exact artifact bytes; they are not proof of successful worker startup, WASM instantiation, native image comparison, HTTP response behavior, or offline operation in a browser.

| Inspected artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `.sites-runtime/frontend-assets.json` | 1,423,958 | `c06b869d868f045990a80c34f589939e4cd294d4e5d546a892bd75843313bd36` |
| `dist/server/index.js` | 1,437,275 | `9c05939f8752bba579636169b517cd3be93897f96fca17c2c9b45a49e7d2947b` |
| `package-lock.json` | 69,399 | `a4cf2ce3225425412ad1a625ed2f20cbdffeac914cf1b199b80c792b15f91acc` |
| `scripts/vtracer-assets.ts` | 1,730 | `e1e0ba489d63767a42004edcfdf6e4a18d6e669ab0fa01778b16b3055eade1a8` |
| `scripts/build-worker.mjs` | 1,504 | `3dfa3c218f599e37b21eecbbf94b7097e04c7860f22869375d955b07d822c391` |

## Complete asset inventory

The manifest contains exactly **12** assets. Parsing the built server found exactly one object with this same complete set of asset keys. Every embedded `mime` and base64 `body` string equals its manifest counterpart. Thus the inspected server carries the same bytes and MIME declarations, with no additional asset entry concealed by a stale manifest.

| Asset path | MIME in the built package | Bytes |
| --- | --- | ---: |
| `/assets/archive.worker-CiSaXQTZ.js` | `text/javascript; charset=utf-8` | 108,026 |
| `/assets/index-D8MZ5ixK.js` | `text/javascript; charset=utf-8` | 549,247 |
| `/assets/index-ftlm9-7n.css` | `text/css; charset=utf-8` | 46,100 |
| `/assets/png-svg-trace.worker-kzO33hez.js` | `text/javascript; charset=utf-8` | 23,330 |
| `/assets/png-svg.worker-C0b26as5.js` | `text/javascript; charset=utf-8` | 2,983 |
| `/favicon.svg` | `image/svg+xml` | 361 |
| `/index.html` | `text/html; charset=utf-8` | 627 |
| `/vendor/vtracer/LICENSE` | `application/octet-stream` | 1,065 |
| `/vendor/vtracer/THIRD_PARTY_NOTICES.txt` | `text/plain; charset=utf-8` | 71,913 |
| `/vendor/vtracer/index.js` | `text/javascript; charset=utf-8` | 8,811 |
| `/vendor/vtracer/vtracer_bg.wasm` | **`application/wasm`** | 237,611 |
| `/vendor/vtracer/worker.js` | `text/javascript; charset=utf-8` | 17,187 |

The built handler decodes the selected entry, forwards its `mime` as `content-type`, sets the decoded byte length and `nosniff`, and serves only existing keys for GET/HEAD. The built WASM declaration is therefore correct for `instantiateStreaming`; this statement is about packaged handler logic, not an observed HTTP response.

## Pinned tracers, relative references, and notices

Installed metadata and lock entries both identify **vtracer-browser 0.0.3, MIT**, and **imagetracerjs 1.2.6, Unlicense**.

Binary equality checks passed for the decoded VTracer entry, worker, WASM, and wrapper license against `node_modules/vtracer-browser/dist/{index.js,worker.js,vtracer_bg.wasm}` and `node_modules/vtracer-browser/LICENSE`. The decoded notice asset equals `THIRD_PARTY_NOTICES.md` byte for byte. The packaged favicon also exactly equals `public/favicon.svg`.

| Decoded asset | SHA-256 |
| --- | --- |
| VTracer entry | `40d3fc0e8a2d2e15581f8c052d358bcd6e55f847f3165d5b29ea958e1b33465c` |
| VTracer worker | `7fcad445c6b808798e6cfc425102cafe937ccc6051969aee18b31c26b7923303` |
| VTracer WASM | `4268d8c00ae604d34d41f0aa6470eb447c0b13635275340e0cdd66f950e2068e` |
| VTracer wrapper license | `2420109dfe8e22f6f552de4548cce03fa8bf3f98f7c4b8976b56995e0838fd04` |
| Tracer notices | `19c5ddd94e75a5645f4689d19b39b561f2e3374fb07ea67f7e8dea4e12aef243` |
| ImageTracer-containing worker | `6e043edbdc57a3a970c68f1187c14fc1cdfdf84fe87186769f01b985fdbebc09` |

The notice document retains the pinned upstream attribution evidence for VTracer **1.0.0-alpha.4**, VisionCortex **0.9.3**, the binding and wrapper, ImageTracer, and the conservative Cargo.lock dependency set. Its exact source receipts, license-text mappings, and two published-crate omissions are described in the notice itself. This package review establishes inclusion of those reviewed bytes; it is not a new legal certification, binary dependency reconstruction, or reproducible-WASM-build claim.

Static module parsing confirms the following production connections:

- `/index.html` loads the inventoried main JavaScript and stylesheet and uses the known favicon.
- The main bundle dynamically imports `new URL("/vendor/vtracer/index.js", document.baseURI).href`.
- That unchanged VTracer entry constructs `new URL("./worker.js", import.meta.url)` and starts a module worker.
- The unchanged worker constructs `new URL("vtracer_bg.wasm", import.meta.url)` and uses that local URL for its WASM fetch. Its streaming path and normal instantiation fallback are included.
- The main bundle constructs module workers at the inventoried pixel worker, tracing worker, and existing archive worker paths.
- The 23,330-byte tracing worker contains the ImageTracer **1.2.6** implementation, including its version and `imagedataToTracedata`, `getsvgstring`, `colorquantization`, and `numberofcolors` members. It has no static or dynamic import, so that implementation is bundled rather than dependent on a separate package/CDN request.
- Every inspected JavaScript asset parsed without a syntax diagnostic. The referenced tracer files are all present under the exact local URLs.

The fixed vendor asset map exports only the five named distribution/license files. It does not copy package demos, package source trees, or an arbitrary directory of files.

## Development and imported-data isolation

The complete production asset inventory contains no QA page, test module, fixture file, source map, source archive, PNG, JPEG, GIF, WebP, video, or ZIP. Its only image asset is the exact existing favicon. Targeted scans of decoded executable JavaScript, HTML, and CSS found no QA harness paths/names, procedural PNG fixture names, QA import identifiers, or embedded PNG base64 payloads. Static import/worker inspection found no development harness dependency.

The main bundle does retain the application's pre-existing procedural **Studio sample archive generator** from `src/demo.ts`. Its `../assets/studio.css` and `../assets/studio.js` strings are contents of an HTML file that the generator places inside its sample ZIP; corresponding generated entries are created alongside it. They are not production imports to missing server assets, and they are not captured user files. License metadata was not treated as executable fixture code merely because upstream package names or text can mention tests.

No imported user payload or newly authored QA fixture was found in this bounded package inspection. This conclusion combines the full asset inventory, source/pinned-file identities, module references, and targeted decoded-code scans. It does not assert that arbitrary unknown private strings can be disproved by string matching, nor does it inspect a user's IndexedDB, downloads, browser storage, or account data. Existing Library cloud functionality is outside this narrow tracer-package network assessment.

## Findings and remaining gate

**Concrete packaging findings: none.** The inspected server and manifest agree; tracer paths resolve within the inventoried asset layout; the pinned WASM and notice bytes are included; ImageTracer is bundled; and the WASM MIME declaration is correct.

The coordinator's separate `revision-4-browser-verification.md` records 13 real IndexedDB checks and a corrected 28/28 development-engine run, including actual curve-quality measurements. Those are development-origin runtime observations and were not repeated here. At this review's completion, actual conversion using the final production asset layout and verification of the published private Site remain the coordinator's explicit next gates. Packaging equality must not be substituted for those execution results.

## Addendum — repeated Site build correction, 2026-10-29 15:52 UTC

**Verdict: correction verified in the inspected source and both resulting packages. No remaining packaging finding.**

The coordinator reported that an intermediate Site-helper build collected a previous `dist/server/index.js` as a thirteenth frontend asset. This intermediate package was outside the original 12-asset snapshot reviewed above. The coordinator changed the collector and rebuilt; this addendum independently inspects the corrected files without running a build or browser.

The corrected guard in `scripts/build-worker.mjs` is evaluated before either directory recursion or file collection:

```js
if (entry.name === '.openai' || (base === '' && entry.name === 'server')) continue;
```

It preserves the existing `.openai` exclusion and excludes `server` specifically at the root of the collected `dist` directory. A prior server output can therefore no longer become a frontend entry or recursively embed its earlier asset table. This inspection confirms the implemented guard; no new synthetic build was executed by this reviewer.

At **2026-10-29T15:52:29.336Z**, independent reads of `/workspace/scratch/6d5f921cc245/folio` and `/workspace/scratch/6d5f921cc245/folio-site` produced the following results:

| Check | Main checkout | Site checkout | Comparison |
| --- | --- | --- | --- |
| Manifest asset count | 12 | 12 | Equal |
| `/server` or `/server/…` asset keys | None | None | Prior output excluded |
| Manifest bytes | 1,423,958 | 1,423,958 | Exact byte and parsed-object equality |
| Built server bytes | 1,437,275 | 1,437,275 | Exact byte equality |
| Parsed server asset objects matching its own manifest | Exactly one | Exactly one | Every MIME and base64 body equals its manifest |
| WASM MIME | `application/wasm` | `application/wasm` | Equal |
| Collector source bytes | Corrected guard present | Corrected guard present | Exact byte equality |

Both manifests retain SHA-256 `c06b869d868f045990a80c34f589939e4cd294d4e5d546a892bd75843313bd36`, and both servers retain SHA-256 `9c05939f8752bba579636169b517cd3be93897f96fca17c2c9b45a49e7d2947b`. These are the same complete package hashes as the original approved snapshot. No application, engine, WASM, notice, or other asset bytes changed in that comparison. The corrected collector has SHA-256 **`db4bd22af03cf7630013c6f8a3a10a575eb62c1665d92a7e6f0f45bc52903dd2`** in both checkouts, superseding the collector-source hash recorded in the first table above.

The coordinator identifies source commit `89fbdce1e3ec5701f0db0f49d879e462d258c9d4` for the repair. That commit receipt is coordinator-supplied: the local Git lookup did not resolve `scripts/build-worker.mjs` at that object, so this reviewer binds the source verification to the actual equal file hashes rather than claiming an independently verified commit-to-file mapping.

The coordinator additionally reports actual production execution of opaque VTracer with zero differences, RGBA ImageTracer with 54/60 differing pixels, and silhouette ImageTracer with 424/9,216 differing pixels. Those are separately owned runtime observations, not results produced by this read-only package review. Remaining queue, HTML, and publication journeys must use their own runtime evidence; the equality checks here do not substitute for them.
