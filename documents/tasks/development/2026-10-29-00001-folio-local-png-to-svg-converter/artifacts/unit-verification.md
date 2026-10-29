# GUT — unit and integration verification

Verifier: `/root/codebase_assessment`. This agent also authored the new PNG core tests and procedural fixtures; this is **test-author verification, not independent test design or independent code review**. `/root/fidelity_research` owns independent code/security review. No source, test, dependency or Git changes were made during this verification assignment.

## Source and environment

- Checkout: `/workspace/scratch/6d5f921cc245/folio`.
- Local HEAD at start: `dec0cda5102f62163431687639cae59ab40e90cc`, plus the current staged engine/tests and working UI integration.
- Node: `v24.22.1`; TypeScript: repository version `5.8.3`.
- Verification interval: `2026-10-29T13:12:42.523412+00:00` through `2026-10-29T13:13:25.452632+00:00`.
- Source hashes below were recorded before and after verification and were unchanged across that interval. Root owns later targeted UI edits and final production packaging.

## Commands and actual results

| Command | Result | Evidence and boundary |
| --- | --- | --- |
| `npm test` with default sandbox | **Blocked by environment**, exit 1 | Existing `pretest` privacy gate could not invoke its Git subprocess and correctly refused to pass. Test assertions had not run. |
| `node -e 'try { require("node:child_process").execFileSync("git", ["ls-files", "--stage", "-z"]); console.log("git subprocess succeeded"); } catch (error) { console.log(error.code, error.message); process.exitCode = 1; }'` | **Confirmed environment cause**, exit 1 | Output: `EPERM spawnSync git EPERM`. No validator was changed or bypassed. |
| `npm test` with `sandbox_permissions: require_escalated` | **Passed**, exit 0 | Existing pretest index privacy scan passed for 122 source files; all 4 repository-privacy tests passed. Main suite: **177 tests, 176 passed, 0 failed, 1 skipped, 0 cancelled**. Main-suite duration: 9999.460045 ms. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | **Passed**, exit 0 | No diagnostics. Checks actual app/worker/browser engine and UI types through existing `tsconfig.json`; writes no build artifacts. |

Combined executed assertions: **180 passed and 0 failed**, plus **one pre-existing optional fixture test skipped**. The 19 new converter tests all executed and passed within the main suite.

The skip is `real Library wrapper reconciles 12 pages with its two unchanged source ZIPs`, controlled by the existing `skip: !existsSync(realFixture)` at `tests/archive.test.ts:147–148`. Its external real-data ZIP is not present. This is recorded as skipped, not passed; private fixture payloads were not introduced into the repository. Synthetic nested archive tests did run.

Npm emitted its existing `Unknown env config "http-proxy"` warning; it did not affect the successful escalated suite.

## Acceptance coverage

- **T1 / R2, R3, R9:** independent integer-rectangle raster reconstruction for seven procedural fixture classes; every visible pixel covered once, no overlapping geometry, exact alpha/channel preservation; solid/run merging, gaps and different opacities; raw input bounds; exact differing-pixel count with zero tolerance and hidden-RGB exceptions only when both alphas are zero.
- **T2 / R4, R7:** original embedded PNG bytes read back unchanged, including actual indexed palette transparency; ordinary/Unicode/case/NFC/suffix/device-name handling; a real generated ZIP read back through JSZip with all allocated filenames and exact SVG bytes preserved; unsafe or duplicate output names rejected.
- **T3 / R5, R8 (pure logic portion):** actual procedural PNGs independently inflated by Node zlib; valid signatures/chunk CRC generation; real 2-bit `PLTE` plus `tRNS`; malformed/truncated structures, invalid dimensions/layouts, APNG, pixel/file limits, rectangle and SVG-output budgets. Browser cancellation/session lifecycle/network checks remain separate GVE/GVS evidence.
- **T7 / R1, R8, R12:** full existing suite and actual source typecheck passed, with the unchanged privacy validator executed successfully under the required Git subprocess permissions.

Existing regression coverage executed includes recursive/nested ZIP imports, resource-byte preservation, path and CRC protections, image import metadata, cloud metadata selection and local resource isolation, cloud worker authorization/checksum/streaming contracts using test data, Google Drive input/download validation, shared gallery capacity/pagination, component callbacks, observer cleanup, thumbnail queue/cache behavior, image dimensions and URL lifecycle, folder favorites and keyboard handlers, metadata/date sorting, shared tree projection/navigation, and organization identity preservation.

These are Node/pure/component tests. They do not establish actual browser IndexedDB persistence, native canvas/SVG rendering, cross-browser fidelity, accessible rendered focus behavior, production collection access or deployment success.

## Remaining verification boundaries

- **Not run here:** production build/package, browser journeys, actual PNG decode → SVG raster comparison, viewport/accessibility review, live-site checks and deployment. Root and the separately assigned reviewers own these.
- The required positive browser fidelity results for opaque, transparent, partial-alpha, antialiased, palette and multicolor PNGs cannot be inferred from these unit passes. Embedded partial-alpha rendering and the browser negative single-pixel control also require GVE.
- The original-data fixture skip remains explicit. No test waiver or success was invented.
- If any listed source changes after this interval, retain this evidence and rerun only checks affected by that change, plus any final required gate.

## Verified source hashes (SHA-256)

| File | SHA-256 |
| --- | --- |
| `src/App.tsx` | `86eecd9d287f160e6123dfa5b8ddb1a67139a8b3a36e9c4791b61d3617540572` |
| `src/components/PngSvgWorkspace.tsx` | `3e58e8f73b8c43b57afdc67fd9c4307959811f76646ee17761a2b2ef29f33705` |
| `src/components/png-svg.css` | `515b0f49b5c29fc7c4324e158f9a04ddcec74dcbd8a9c1ffebbd98a3a5186b3c` |
| `src/png-svg.ts` | `e406285f9a947e8b9dec6a78d92b3a0c38d22d363404ad95311f7e87d2d45f3c` |
| `src/png-svg.worker.ts` | `dfcc0a77887594ed42894504720e0ba4cc4f5ad1f99eaf9fa0a1d50e5e2ebbfc` |
| `src/png-svg-browser.ts` | `f13182d83269a4ccdc98b77b6285e24e4814eed86950ee7ef1b5d0e786f265e2` |
| `src/png-svg-download.ts` | `90e65a69e58bee08f2610882db7c6389d3faac7fbb4794fbca2f8721e89bed76` |
| `tests/png-svg.test.ts` | `8f00a0c4a0cc98203c96ef7fd6c9f27c63272e953d134095ed195c65831caf9c` |
| `tests/png-fixture-generator.ts` | `b5efb9d8a5d62ee8f3fabfd2de9b2965f50efff9435e71c0f0ab264c1be8a444` |
| `package.json` | `3fd411b6b5510d7a0fdf49118385a88f10f107aa4882f5702981f3aeb504ab3e` |
| `tsconfig.json` | `dfeef99034a4c397397b6fae39d03d23fd8a61496e58e902a90ef0524ab39f35` |
