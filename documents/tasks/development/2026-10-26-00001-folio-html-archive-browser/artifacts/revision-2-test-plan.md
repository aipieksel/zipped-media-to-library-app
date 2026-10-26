# Verification — revision 2

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