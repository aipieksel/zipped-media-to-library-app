# Revision 9 — native browser and interface verification

Date: 2026-10-31. Owner: /root. Environment: Chrome 155.0.0.0 on Linux,
managed Folio preview at `http://terminal.local:4173/`. All inputs were generated
procedural fixtures in that development origin. No user media or credentials were
used. Source baseline for these checks is pushed commit `59b60c9`, with the final
AI-settings/dialog and development-harness corrections recorded in the next
checkpoint. Production and the user's Mac are separate environments.

## T22 — actual IndexedDB and exported bytes: passed, 6/6

Procedure: open the generated `/.qa/saved-icons.html` through the supported cloud
browser and run `runSavedIconChecks()` with its UI button. The actual browser
reported six passes, zero failures, from 16:13:50.074Z to 16:13:50.459Z.

1. Create the old v1 icon database, upgrade to v2, and read original input, output,
   folder and preference records back. Existing records survive; new Saved stores
   exist without clearing the conversion stores.
2. Save artwork, delete its original conversion and folder, reload, and check
   destination collision handling. The saved source and output remain. Recolor
   produces 52 differing native pixels on the procedural fixture. ZIP content
   equals the current saved bytes; reset restores the exact immutable base bytes
   and saved check. Explicit deletion removes the three owned Saved records.
3. Force a native IndexedDB transaction abort. Metadata, base/current SVG, source
   and selection roll back together; the subsequent recovery succeeds.
4. Retry during save, late AI response, stale color/check and post-delete response
   are rejected. Deleted artwork is not resurrected.
5. Trusted original-byte embedded conversion saves exactly and remains
   non-recolorable. Generic AI embedded images and forged wrappers are rejected.
6. Safe unique names, favorite/move/selection persist. Impossible verification
   counts are rejected.

The first harness attempt used `crypto.randomUUID` in a context where that helper
was unavailable. The harness was corrected to use the application's existing
`uniqueId`, then all six checks passed. No production storage behavior was changed
to obtain this result.

## T21 — actual source-format preparation: passed, 2/2

Procedure: run `runAiSourceChecks()` from the existing icon-library harness.
At 16:21:10.695Z–16:21:11.754Z, both cases passed: real WebP bytes declared as
`image/png`, and the same WebP with an empty MIME type. Each source was 558 bytes,
12 × 10; its normalized PNG attachment was 150 bytes. Source metadata is corrected
only after actual preparation validation. Incorrect metadata is rejected by strict
storage admission; save/reload retains the exact original WebP bytes, correct MIME
and filename. The procedural SVG comparison reports 30 differing pixels.
Provider requests: zero.

## T21/T23 — actual application journeys with a declared response fixture

The real App, components, SVG validator, native renderer and IndexedDB were used.
Only the iframe's exact loopback `/v1/*` fetch boundary was replaced by the
development-only `QA fixture · no provider` adapter. Authentication was explicitly
`not checked`. The fixture is excluded from the production entry graph and
disabled on reload. Its 18 exported observations are retained in
[revision-9-browser-ui-observations.json](revision-9-browser-ui-observations.json).
These checks establish application behavior, not AI quality or account success.

| Procedure | Observed result |
| --- | --- |
| Import seven generated PNG cases through the existing app harness | Automatic conversion; the selected opaque 16 × 12 source produced six rectangles and a measured zero of 192 visible differences. |
| Save the ready conversion | Saved count becomes one; same ArchiveTree; conversion remains available. |
| Enter `#1a73e8`, Apply color, reload, switch tabs | Current saved SVG stays blue, with 192 measured differing pixels and no false pixel-match badge. |
| Open global menu → Settings → AI | No automatic pairing. Explicit fixture connection loads its labeled model and medium reasoning. Preferences survive reload; pairing code does not. |
| Test the fixture connection | Declared fixture text request; provider request count remains zero. This is not a real account test. |
| Keyboard ArrowRight from AI tab, then Escape | Profile tab receives focus; Escape closes the modal and restores Workspace menu focus. Dev Profile shows its unavailable-account error, Retry and real sign-in route. |
| Keyboard Space on Convert while Saved is active | The replacement Convert toolbar button retains focus. |
| Recreate with AI on the conversion page | Request contains a validated 155-byte native 16 × 12 PNG attachment, 57 instruction characters and current SVG context. Candidate is separate, displays 192 actual differences and approximation text. |
| Save candidate | Saved count becomes two; original conversion remains the zero-difference result. |
| Hold cleanup response, then Cancel | AbortSignal and cancellation endpoint both observed. UI returns to Generate without replacing source/candidate. |
| Return unsafe SVG containing a script element | Validator rejects it with “The SVG contains unsupported or non-vector content.” No accepted candidate or save is offered. |
| Import and select an original image in Images, open AI SVG | Original image is retained (848-byte input). Cleanup is disabled without an existing SVG. Recreation uses the same shared settings and panel; save brings Saved count to three. |
| Reload and use 390 × 844 layout | HTML/Images/Icons and menu fit; Saved toolbar wraps; drawer uses the existing tree. Choosing the saved blue icon closes the drawer and restores the toggle focus. Color remains `#1a73e8`. |

The color-picker DOM-fill attempt did not prove a real operating-system picker
gesture; the separately labeled hex input and Apply flow were exercised. Color
input also handles the input event. No native OS-picker success is claimed.

## Narrow dialog repair and readback

The first narrow settings view exposed two vertical scrollbars. The final CSS
uses a fixed header/tab region and one flexible scrollable content region. After
reloading the corrected source, the actual 390 × 844 layout measured:

- outer dialog: 356 px wide, 715 px high; scroll width 356, scroll height 715;
- header: 52 px; tabs: 40 px;
- active panel: 621 px high, scroll height 1,004 px.

There is no horizontal overflow or outer dialog scrolling in that measured state.
Title, close button and tabs remain visible while content scrolls. The final
disconnected model/reasoning placeholder correction was source-reviewed and
compiled; it did not receive an additional native readback.

## Failures and unverified boundaries

- A browser screenshot command timed out. Screenshots were visually inspected
  during the successful UI calls, but no final downloadable screenshot artifact
  is claimed.
- Waiting for the individual saved-SVG browser download timed out and reset the
  automation kernel. Actual browser/OS delivery of that click is **unverified**.
  No UI ZIP-delivery pass is claimed. Actual stored SVG and ZIP payload equality
  passed the independent native-storage checks above.
- The shared managed preview sometimes served another workspace. Only observed
  Folio sessions are included; unrelated content is not accepted as evidence.
- The connected user browser showed the existing private Site's sign-in wall.
  Live authenticated profile and sign-out were not exercised. The 9 Worker identity
  tests and independent account source review are separate evidence.
- Real Codex login, catalog/model discovery with the user's account, text inference,
  attached-image inference and browser-to-user-companion connectivity remain
  **not_run**. A public fixture pairing code is not a provider credential.
- Safari/Firefox, other color profiles, screen-reader announcements, measured
  contrast and physical operating-system drag/drop were not tested in this pass.

## Outcome

T21 and T22 pass within their declared fixture/native-render/storage boundaries.
T23 passes the listed desktop/narrow and keyboard journeys; unexecuted accessibility
and delivery boundaries remain disclosed. T20/T24/T25 retain their live-user
prerequisites. This report does not close R29 or claim overall task completion.
