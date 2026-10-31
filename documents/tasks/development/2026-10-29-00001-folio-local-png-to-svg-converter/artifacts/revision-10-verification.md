# Revision 10 — coordinator verification

This receipt distinguishes implementation tests, synthetic native-browser checks and production activation. Existing revision9 evidence remains historical; it does not prove the new account/shared-storage paths.

## Automated gate

- Full `npm test`: **328 passed, 0 failed, 1 existing optional private-Library skip** (329 application cases). The preceding privacy suite also passed **4/4**.
- TypeScript, Vite production build and Worker packaging passed. The Worker explicitly selects `workerd` exports so concurrent Better Auth requests use native request-local context.
- Git-index repository privacy scan passed. No production credentials, original media, private catalogue or browser capture was added to source.
- The first complete suite found two old expectations for immutable media caching. They were updated to the reviewed `private, no-store` behavior, with extra HEAD/conditional-response assertions. Authorization/revocation tests independently protect those routes.
- Build warnings concern mixed static/dynamic imports and the existing single main bundle approach. Main JavaScript is approximately998kB minified /319kB gzip; no warning was hidden or treated as an error-free performance audit.

## Independent reviews

The server, client/account, shared persistence and accessibility receipts record actual reproduced findings, corrections and source hashes. All material findings in those bounded reviews are closed. Specific repairs include request-context concurrency, stale jobs crossing sessions, complete-response deadlines, lost writes, metadata capacity, untrusted shared SVG/fidelity fields, migration repacking and download-name collisions.

## Native persistence

`revision-10-native-persistence.json` is the root-owned Chrome155 receipt: **8 groups passed, 0 failed**. The credentialless child used an isolated native IndexedDB partition; the parent database names stayed unchanged. The fixture checks migration/idempotency, exact migrated source/output content, failed publication and explicit recovery, conflict merging, queue ownership, fresh SVG rendering, hidden roots and logout fences. Its transport is synthetic; the separate Worker tests use real Better Auth, D1 and R2 in workerd.

## Actual application browser observations

The development-only application entry uses the real account/shared API through an isolated workerd fixture. All files used were procedural test fixtures, not production media. No real AI provider was contacted.

- Sidebar begins at the top of the viewport; the old top navigation bar is absent. The custom Workspace selector changes HTML/Images/Icons while retaining the canonical sidebar/search/tree.
- Found and fixed the real popup mounting defect: an explicit null portal container suppressed the body portal. Undefined now selects the normal body portal; a native dialog still receives its own container.
- Three procedural PNGs entered the shared Icons workflow. An interrupted upload retained a visible recoverable change. **Settings → Workspace → Retry** published it, all three converted automatically, and the selected opaque fixture showed zero of192 native pixels differing.
- Saved that completed conversion to the shared icon library and applied `#2244aa`. The chosen color appeared in the saved output state. Source conversion and saved artwork remained separate.
- Settings navigation rendered a full page with a full-height left navigation, right-hand content and logout. Profile, Workspace and Appearance were exercised. Section headings follow a page hierarchy.
- Saved a six-field dark palette through the real appearance API. The UI acknowledged the shared save; measured root colors were accent `#6fa8ff` and canvas `#15191f`. The Settings sidebar matched the936px viewport height and there was no open settings dialog or native select.
- At viewport widths **320,768,1440**, measured document widths matched exactly. Convert/Saved controls remained27px tall with `white-space:nowrap`; the sidebar geometry began at y0 and matched the850px test viewport. The390px layout was visually inspected.
- In the390px sidebar, first Escape closed only the open workspace selector; second Escape closed the sidebar and returned focus to its toggle.
- In the desktop Sort popover, ArrowDown opened the select; End changed focus without changing the value; Enter committed Oldest first while the parent popover remained open.

## Environment and claim limits

### Final native-dialog and short-screen checks

The root then ran `tests/revision10-ui-fixture.tsx` in the same Chrome155 browser, using the actual production Modal, PopoverSelect and SettingsPage components and CSS. The fixture has no API or storage operations. These remaining checks completed without a preview interruption:

- At390×360, the custom dropdown opened inside a native modal's top layer. Selecting Smooth curves changed the controlled value, kept the modal open and returned focus to the trigger. The disabled option remained disabled.
- First Escape dismissed only the list. Tab reached the following text field. Escape from that field dismissed the native modal and returned focus to its original opener.
- Settings with all five tabs, a long synthetic display name and a synthetic logout failure had no document horizontal overflow at320×360,390×360 or640×360.
- At320/390px, the logout action and complete error occupied normal flow above the horizontally scrollable section navigation. Selecting the initially offscreen Accounts tab scrolled it into view and moved focus to the Accounts heading.
- At640×360, the full-height sidebar was360px tall with435px scrollable content. Clicking Log out scrolled the sidebar75px, exposed the footer/error and incremented the fixture's action counter. The content pane scrolled separately; no footer overlap or inaccessible fixed element was observed.

This fixture verifies rendered component behavior, not a production account logout or a screen-reader session. The scoped fixture TypeScript check passed. Independent documentation audit findings were corrected in README, PRIVACY, companion documentation and the relevant evidence artifacts; `revision-10-doc-review.md` records all seven closures.

The environment has a single managed preview shared with another active project. It repeatedly changed from Folio to that project's server during testing. Affected reloads returned missing Folio routes, and later background requests returned404/405. Those interrupted journeys are not recorded as successful persistence or account tests. The isolated native runner completed successfully before subsequent interruption.

The actual SVG download click was issued, but browser download-event delivery timed out; OS delivery is not certified. SVG/ZIP bytes and safe naming are separately covered by export and shared-data tests. Actual page zoom, assistive-technology interaction and universal browser/profile color accuracy are not claimed.

Production publication, native-host compatibility and the owner setup screen require a later release addendum. The owner's real Folio password must be chosen by the owner; no production account has been fabricated. Prior requirementR29, a real user-local OpenAI/Codex image inference, is still a distinct activation prerequisite.
