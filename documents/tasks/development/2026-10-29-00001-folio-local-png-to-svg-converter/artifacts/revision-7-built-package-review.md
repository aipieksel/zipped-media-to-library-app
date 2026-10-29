# Revision 7 — built package review

**Verdict: approved for the inspected packaging scope. No unresolved packaging finding.** Production conversion and published-Site execution remain separate coordinator-owned gates.

Reviewer: `/root/codebase_assessment`, 2026-10-29, approximately 17:19–17:21 UTC. This reviewer authored collection/storage and development-test code, but did not author the build collector, asset plugin, release archive, or native contour implementation. This is a bounded package review, not an independent review of all application source. Only this report was written; no build, install, test suite, browser, server execution, application edit, or Git mutation was performed.

## Source and immutable artifact identity

Site checkout HEAD was independently read as `1e84baac2023be4a53c0eaabdb9e036c544bb688`; its runtime/config/package paths had no working-tree changes. The union of `src/`, `worker/`, `public/`, `scripts/`, `index.html`, and `vite.config.ts` contained **69 files in each checkout, all byte-identical**, with no omitted or extra file. `tsconfig.json`, `package-lock.json`, and `THIRD_PARTY_NOTICES.md` also matched. Dependency and development-dependency maps matched. Site `package.json` intentionally retains its existing scripts: only main's `check:privacy`, `prebuild`, and `pretest` hooks differ.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Site frontend manifest | 1,449,250 | `2149127d7f33e137815413c16a439a4b640a428d92a5bf038599db71da5c6ee7` |
| Site `dist/server/index.js` | 1,462,567 | `300ad61cd6ebb4030605701759bcaa82c9409670e65d49f087ce0b219ad0f228` |
| `folio-icons-revision7.tar.gz` | 535,061 | `52e4739e31219731aa206c03c61de6307c012a7675a99cd23b4042972efe1c0f` |

The archive contains only directories plus `dist/.openai/hosting.json` and `dist/server/index.js`; both file bytes exactly match the Site checkout. There are no links or other payload members. Parsing the built server without evaluating it found exactly one asset object with the manifest's complete key set; every MIME and base64 body matched exactly.

## Public assets, engines, and notices

The **12** assets are the main JS/CSS, archive worker, pixel worker, tracing worker, favicon, index HTML, and five fixed VTracer assets (`index.js`, `worker.js`, `vtracer_bg.wasm`, `LICENSE`, `THIRD_PARTY_NOTICES.txt`). All six executable JavaScript assets parsed successfully. Their six static import/worker/WASM references resolve to entries in this inventory; HTML references the emitted main JS/CSS and favicon.

WASM is declared **`application/wasm`**; JS, CSS, SVG, HTML, and notice MIME declarations match their file types. Decoded VTracer entry, worker, WASM, and wrapper license bytes equal the installed package files. The emitted notice equals the source notice, and the favicon equals its source.

The tracing worker `/assets/png-svg-trace.worker-CdsMPNiV.js` is 33,867 bytes (SHA-256 `18e8491cb2800e98e28771d4e3df308a6bdf59fb3309332ae40f549c9a86cfff`). Its actual boolean `silhouette` dispatch calls the bundled native alpha contour implementation before the separate ImageTracer fallback. The bundle contains alpha-127.5 extraction, contour/fitter limits, fitCubic, and work-limit failure handling. The main bundle contains the **Native alpha contours / silhouette profile 3** identity and WebP format handling.

`fit-curve` is exactly **0.2.0** in the installed package, package declaration, and lockfile. The entire installed MIT license, including the 2014 Volker Poplawski copyright, is present in the emitted notice. That notice has SHA-256 `8014f45a255475ab24584864e8030a6804d0772eaae434f2e002532ed465e07f`.

## Public boundary and limits of this review

No asset key exposes `server/`, QA pages, tests, fixtures, source maps, raster media, archives, or recordings. Decoded executable/text assets had no matches for the targeted QA harness names, procedural test fixture identifiers, local QA host, or long inline PNG/WebP payload markers. This bounded scan cannot establish the absence of every possible unknown private string.

The collector still excludes `.openai` and root `server` **before directory recursion**; its SHA-256 is `db4bd22af03cf7630013c6f8a3a10a575eb62c1665d92a7e6f0f45bc52903dd2`. The prior server-as-public-asset regression is absent. The handler serves only known manifest keys for frontend GET/HEAD, forwarding the declared MIME, byte length, and `nosniff` header.

These checks bind the inspected archive and asset layout. They do not establish actual HTTP behavior, Worker/WASM startup, visual fidelity, mixed-format import, browser persistence, download delivery, or publication success; those require the coordinator's separate production and live-Site evidence.
