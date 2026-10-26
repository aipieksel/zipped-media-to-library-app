# Verification — revision 3

## T1 — R2, R3, R8, R10

Node tests against archive/path/tree code with nested real ZIP wrapper, empty and malformed input, traversal and inflation limits.

Expected: 12 HTML pages reconcile; assets retained but not tree-visible; bad inputs rejected without altering workspace.

Boundary: Deterministic processing, no browser rendering proof.

## T2 — R1, R4, R5, R7, R8

Managed Sites browser upload, click and key navigation; inspect rendered real banner/pattern resources and gallery reveal. Explicitly check CSS @import/url() computed colour and image loading; JS-driven button; local fetch JSON; static module chain and literal dynamic module import.

Expected: Real pages and linked assets render; selection changes correctly and screenshot points back to identical page ID.

Boundary: Available cloud Chromium runtime; no backend/server apps supported.

## T3 — R6, R7, R9

Browser current/batch capture, cancel/retry and reload; inspect actual PNG output and preserved imports.

Expected: Nonblank image captures persist; serial queue succeeds or exposes explicit failures; UI remains navigable.

Boundary: Browser DOM capture, not pixel-perfect remote Playwright; remote CORS and unsupported media may limit capture.

## T4 — R4, R10

Independent source review plus browser keyboard and malicious harmless fixture checks. Check an unrelated source window cannot forge a bridge message.

Expected: Iframe cannot read parent DOM/storage, bridge is source/channel scoped, input focus preserved, controls labelled.

Boundary: Bounded review, no formal accessibility or security certification.

## T5 — R1

Typecheck, production build, source push and native Sites private deploy result.

Expected: Build succeeds and native deployment returns succeeded with production URL.

Boundary: Source, packaging and deployment evidence distinct.

## T6 — R11

Inspect desktop and 390px-wide rendered shell; DOM bounds and screenshot verify full-height left sidebar, one compact toolbar, one-line drop hint, no logo/reload or exposed capture/device row. Open settings and operate fit/width/capture.

Expected: Content uses available space; essential actions remain labelled and reachable; popover dismisses and restores focus.

Boundary: Cloud Chromium with authored narrow viewport harness if browser resize unavailable.

## T7 — R2, R3, R5, R9, R10, R16, R17

Unit ZIP/image classification checks; browser v1-to-v2 upgrade retains 19 existing HTML items, seven captures and existing selected ID; Images tab indexes original bundled images. Import a nested image ZIP plus a direct image and render/download supported PNG/SVG.

Expected: HTML and Images inventories are separate, resources remain available, image data renders safely via img object URLs, corrupt/unsupported imports report failure.

Boundary: Browser supported PNG/JPEG/WebP/GIF/AVIF/SVG/BMP/ICO; no native TIFF/HEIC conversion or remote storage.

## T8 — R13, R14, R15, R17

Create folder, favorite HTML/image, move each into folder, reload; navigate moved HTML with linked assets; download original image and HTML resource ZIP, inspect resulting files/bytes.

Expected: Identity and resources survive moves and refresh; favorites and folder membership persist; downloads contain original selected bytes and usable associated resource hierarchy.

Boundary: Folders organize workspace references, not original ZIP paths; one item belongs to at most one user folder.

## T9 — R4, R7, R11, R12, R13, R14, R16

Collapse all branches, navigate previous/next through current kind and wrap last-to-first; test matching search/favorites/tree/gallery orders, image/gallery opening, keyboard input protection and popover focus.

Expected: No folder selection needed for browsing; current-kind navigation remains coherent after moving/favoriting/filtering.

Boundary: Source/keyboard review and available browser observations, no formal conformance claim.
