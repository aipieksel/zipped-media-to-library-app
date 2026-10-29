# GVD — converter documentation updates

Actor: `/root/codebase_assessment`. Scope: `README.md`, `PRIVACY.md` and this evidence artifact only. No app/test/dependency changes, builds, Git operations or publication were performed in this assignment.

## Updated documentation

- **README.md:** Library/PNG to SVG navigation; preserved Library behavior; scoped drop and shortcut instructions; batch workflow; default merged pixel geometry versus explicit original-byte bitmap embedding; preview controls; retry/reconvert and individual/ZIP download behavior; safe output naming; exact native-size 8-bit sRGB RGBA comparison semantics and honest result labels; scaling/profile/16-bit limits; session memory lifetime and all current processing/retention limits.
- **README.md development section:** focused core-test invocation, shared procedural fixture categories, the actual development-harness preparation command and local paths, and the separation between pure tests, actual browser results and production deployment.
- **PRIVACY.md:** converter data stays in memory, separate from IndexedDB/Drive/cloud collection; generated SVG/PNG/ZIP payloads remain excluded from source control and CI artifacts; synthetic fixtures and ignored QA output preserve existing media policy.
- Existing instructions, collection storage, build/Worker configuration and repository safeguards were retained. The source synchronization paragraph now identifies the old Sites checkpoint as the integration starting point, not a claim that new changes have already been published.

## Source readback

Documentation was checked against `src/App.tsx` workspace navigation and shortcut gate, `src/components/PngSvgWorkspace.tsx` UI labels/queue/retention limits/session ownership, `src/png-svg.ts` pure metadata/merging/serialization/comparison/naming, `src/png-svg-browser.ts` source decode/actual SVG raster comparison/profile warnings, and `src/png-svg-download.ts` ZIP construction.

Current limits documented from code: 20 MiB input; 4096 pixels per side and 4,194,304 pixels total; 150,000 merged rectangles; 24 MiB SVG; 100 retained files and 100 MiB source bytes; 128 MiB retained SVG output. The README uses MiB because the implementation uses powers of 1024, even where the UI abbreviates these values as MB.

The exact harness command is `node --import tsx scripts/prepare-png-svg-check.mjs`; the `tsx` loader is necessary because the script imports the TypeScript fixture generator. The engine author reported successful execution generating seven fixture PNGs plus `.qa/png-svg-check.html` and `.qa/png-svg-responsive.html`. This documentation actor inspected the actual script, confirmed both generated HTML paths exist, and inspected the `import.meta.env.DEV` guard in `tests/png-svg-browser-check.ts`. No browser pass is inferred from helper generation.

All relative Markdown links in the edited README/PRIVACY files were checked and resolve to existing files. The focused/full test outcomes are recorded separately in `artifacts/unit-verification.md`. Browser version, native-render results, download UI behavior, accessibility and deployment remain owned by their actual evidence records; no unsupported universal accuracy or already-published claim was introduced.
