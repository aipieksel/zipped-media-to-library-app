# Folio implementation plan — revision 2

## Authority and deliverable
Current user message S1 captured verbatim in conversation.json/requestSources. GA 0123 plus browser, accessibility and security verification. Deliver a privately published working Site, not merely a specification. User explicitly requests ChatGPT Sites and testing their Library ZIPs. Checkpoint source during meaningful milestones; publishing follows Sites skill.

## Existing UI and owners
New project with no existing UI. React 19 + Vite static application. Root owns source/build/publication. Archive data model and IndexedDB are canonical owners; tree and gallery derive from the same page IDs. Scope is browser-side HTML documents and their supporting resources. Actual script-dependent editors are supported to extent their browser APIs work inside an isolated iframe.

## Architecture
Read architecture consultation before critique. Use opaque sandbox allow-scripts, without allow-same-origin, in srcdoc. Inline/encode local linked resources; CSS @import/url and JS import specifiers resolve relative to their owning file. Do not base previews on a same-origin Service Worker VFS, because opaque sandboxed clients do not inherit its controller. Use es-module-lexer to rewrite local imports to stable synthetic absolute specifiers, plus a complete import map from those specifiers to data URLs. Entry script src uses its direct data URL. Test a static chain and literal dynamic import; do not use regex-only parsing. Fetch bridge is restricted to the current archive, verifies event.source + unpredictable channel, and normalises every requested path. Local HTML links reveal corresponding tree page. No unsupported promise that imported server apps work.

Capture with html-to-image running inside the sandbox, serial off-screen frame, wait for assets/fonts and configurable settle delay, timeout/cancel each job, persist actual PNG Blob by page ID and capture dimensions. Keep current viewer independent from capture queue. Screenshots are browser-rendered previews and may differ for cross-origin assets, video, canvas/WebGL or unsupported CSS; report a failure rather than fabricate an image. Prove the pipeline in the real browser early. Browser storage is local to device/profile; no cloud upload of user files.

## Design
Folio: white navigation/sidebar, light neutral canvas, charcoal text, orange active accent, compact 290px tree, native buttons with focus rings. Main app has live/screenshot modes and gallery; no marketing site wrapper. Index pages use containing directory/ZIP label. Only HTML and meaningful folder/archive groups are visible. Expand/collapse all and each group. Up/Down changes the selected page; Left/Right opens/closes tree branches. Text inputs retain their arrows. Sidebar scrolls to revealed page. Desktop/tablet/mobile canvas sizes, fit zoom. Toolbar remains legible at narrow widths; mobile sidebar drawer.

## Ordered steps
P1 archive worker, pure path/tree logic, IDB transactions (R1/R2/R3/R9/R10).
P2 preview compiler, isolated message bridge, capture queue (R4/R5/R6/R10).
P3 React app shell, tree, gallery, actions, empty/loading/error/responsive states (R1/R3/R4/R6/R7/R9).
P4 real fixtures, focused tests, independent review, repairs, build/source sync and native private deploy (all R).

## Scope delta
All app behaviour is new. Multi-import, nested tree, keyboard, linked resources and screenshots/gallery are directly requested. Persistence/removal are implementation support for repeated multi-archive viewing; no external account or data upload. Necessary isolation and bounded extraction prevent a viewed archive accessing the workspace or exhausting it. Limits must be visible in help; no fixed number of archive uploads. Test files remain excluded from production assets. No extra paid/provider integration. No editing of imported page designs/content; runtime instrumentation is only for preview/navigation/capture.

## Verification and risks
See test-plan.md. Real Library source inventory in ../fixtures/fixture-manifest.json outside checkout. Synthetic wrapper explicitly distinguished from original files. Protect source identity for duplicate file/archive names. Handle unsupported, encrypted, empty, truncated, nested-too-deep and oversized archives independently; do not lose earlier successful imports. External URLs need internet and CORS for capture. Main thread must stay responsive (worker extraction + serial capture). Browser preview infra and camera path require early runtime proof.

## Review corrections, revision 2
F1 explicitly combines module parser + stable specifiers + complete import map. F2 test assertions now cover CSS imports, JS interaction, local fetch, module chain and forged-source messages. These verify already planned behavior without new scope.
