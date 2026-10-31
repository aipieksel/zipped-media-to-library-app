# Revision 10 — decisive verification

T1–T25 retained in record.json and revision9 archive support unchanged requirements; their superseded topbar/modal/local-only assertions do not govern S5. Current checks below cover every affected outcome. Synthetic data only; each report separates source/unit, native browser and hosted evidence.

## T26

Requirements: R1, R15, R16, R33, R36, R37, R38.

Method: Desktop/narrow real-browser shell, all19 dropdown consumers+workspace, keyboard/typeahead/disabled options, nested rich popover and native capture dialog, direct Settings hash/Back/reload.

Expected: Full-height canonical sidebar, no topbar, same control everywhere, atomic Saved count, inner popup Escape first, page-based Settings, preserved workspace state.

Boundary: Rendered UI evidence distinguished from typecheck and source inventory.

## T27

Requirements: R8, R23, R34, R35, R40.

Method: Actual server credential/session tests with isolated D1 storage: bootstrap authorization/concurrency, invited registration, signin/signout, password change/revocation, expired/disabled users, CSRF/rate limits, last-owner protection and protected legacy blob reads.

Expected: No private metadata/bytes for denied sessions; real password hash/session persistence and revocation; no self-escalation.

Boundary: Synthetic accounts only; hosted owner setup requires user password; outer Site gate unchanged.

## T28

Requirements: R5, R7, R8, R17, R18, R19, R20, R23, R31, R32, R40, R41.

Method: Two independent authenticated client/storage contexts import and reload same files/folders/icons/recolor; interrupted upload, missing blob, stale revision, mutation failure, migration retry and logout/back.

Expected: Same IDs/bytes/state for all members; publish atomically, conflicts explicit, original browser data retained, duplicate-free retry, no stale protected UI after signout.

Boundary: Legacy R2 catalogue is not downloaded/reingested; production media not used as fixtures.

## T29

Requirements: R33, R39, R40.

Method: Color validator/contrast/token tests plus native UI default/dark/vivid save/reload/reset across sidebar/tree/popovers/settings/dialogs. Compare artwork bytes unchanged.

Expected: Appearance settings persist through shared owner; surfaces remain readable and icons/previews unchanged.

Boundary: Finite safe CSS colors only; declared selected palette pairs are tested.

## T30

Requirements: R1, R5, R7, R8, R9, R12, R15, R17, R19, R23, R24, R25, R26, R28, R31, R32, R33, R34, R35, R36, R37, R38, R39, R40, R41.

Method: Independent implemented-diff code/security/a11y review, existing tests and focused new suite, final typecheck/build/privacy.

Expected: No unresolved material findings; preserved native PNG/WebP conversion and explicit-only AI behavior; evidence bound to final changes.

Boundary: Do not rerun unavailable real CLI inference or claim it from mocks.

## T31

Requirements: R8, R11, R12, R13, R14, R29, R34, R35, R40, R41.

Method: Remote tree/head readback after each checkpoint; native Site build/package/migration/publication receipt; hosted bootstrap state and accessible UI without creating production credentials.

Expected: Source checkpointed on GitHub, same Site/project/R2/privacy, additive D1, truthful setup/teammate/AI handoff.

Boundary: User password and unidentified teammate are not automated; actual hosted cookie login remains open until owner activates.

### T27 review additions

Exercise cached GET/HEAD/conditional media access after logout and confirm no immutable response caching. Test password reset authority, recipient binding, expiry, replay rejection, new-password login and old-session revocation. These use isolated test identities; no production account is created.
