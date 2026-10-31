# Revision 10 — implementation plan

## Authority, baseline and completion

S5 is the current amendment; S1–S4 are retained constraints and completed history. Source baseline is bdf73305ff51dcd59c2b7c9a94a66501845ca560. Existing same record and Site are retained. Execution, frequent commits/pushes and existing-Site publication are already authorized. Earlier P1–P13 are historical implementations; their topbar/modal/device-only constraints are superseded by P14–P20 where S5 explicitly changes them.

The deliverable is functioning UI and shared authenticated data, not a design report or login mock. Existing R29 requires the user's local authenticated AI companion and is not an execution prerequisite for this amendment. Production owner-password activation and named teammate Site access cannot be fabricated; build and test everything independently and hand off only the actual user-controlled activation.

## Evidence and design

Read artifacts/revision-10-ui-assessment.md (C1–C10), revision-10-ui-research.md and revision-10-account-architecture.md. The UI plan reuses App, ArchiveTree, current import/controllers, compact styles and component roles. A Folio PopoverSelect wraps pinned Base UI1.9.0 with plain CSS. All19 native selects and the workspace switcher use it. Rich menus remain command/panel popovers with the same surface styles. Select portals go inside the closest native dialog; parent dismissal and global file shortcuts yield to active custom selection. Remove the topbar and its height reservation; add footer Settings. Convert/Saved remain a single nonwrapping group.

Settings uses #settings/profile, #settings/ai, #settings/appearance and owner Accounts routes. Keep App-owned collection/AI state mounted, disable file-drop/keyboard actions on settings/auth screens, retain previous workspace for return, and preserve #png-to-svg alias. Left navigation is real links with current-page indication. Profile edits app account details and password; AI stays an independent per-device connection.

## Server and storage contract

Use Better Auth1.7.14 only after a narrow real Worker-compatible build/D1/cookie/hash probe. Pin exact dependency and avoid Node compatibility guesses. A vetted slow password implementation, strict origin/CSRF boundary, bounded request bodies, persistent attempt limits and opaque revocable server sessions are required. No fallback to a fast password hash. If the supported library/runtime path fails, retain an explicit auth blocker and re-review the affected implementation choice before replacing it.

Owner creation must atomically match a configured trusted Site owner subject, never first-signup wins. Subsequent registration uses owner-created recipient-bound expiring single-use copy links. No email is sent. A password change verifies current password and revokes other sessions. Recovery must be a real owner-controlled action with single-use reset capability, not an unsent email. No production credential or test account is created by the agent. Keep Sites auth endpoints and owner-private audience unchanged. Every legacy collection and new shared-storage route requires active Folio membership, except independently authenticated ingestion routes.

One workspace is server-defined. D1 owns accounts/sessions/membership and revisioned shared metadata; R2 owns immutable hash-addressed media. Upload and verify all bytes before atomically publishing metadata/references; stale expected revisions return409. A bounded manifest-per-library-root or dataset service is acceptable if it preserves atomicity, deduplication, documented size bounds and server acknowledgement; no speculative multitenancy/realtime service. Use a separate shared IDB cache so existing local originals remain recoverable. Resolve original/new blobs lazily where possible and avoid copying the existing3.55GB R2 collection. Folder, favorite, hide/remove and saved-artwork state are shared; selection/scroll/conversion worker/AI pairing stay device-local. Reconcile server revisions on visibility and bounded refresh. Failed writes must not show shared-success; retain recoverable local inputs and never silently overwrite conflicts.

Existing device files need explicit migration with record/byte inventory and destination. Preserve stable IDs, folder relations, original bytes, saved base/current SVG/recolor, fidelity provenance and retry idempotency. Keep originals until explicit removal. Default new imports use the shared workspace after Folio login. Conversion remains local; sharing is storage, not automatic AI upload.

## Appearance

One validated palette owns background, surface, accent, text, muted text and border colors, with derived selection/hover/accent foreground. Preserve current defaults; expose clear save/reset controls. Shared settings are server-authoritative; temporary preview stays local until Save. Extend hardcoded UI surfaces to semantic variables without changing source images, imported HTML, SVG artwork or explicit checker/light/dark preview colors. Reject unsafe strings and unreadable foreground pairs with a useful validation message.

## Execution ownership and ordering

Root is the sole coordinator, plan/Git/package/build/release owner. Delegated implementations receive disjoint file ownership: dropdown primitive plus non-App consumers; auth/shared server modules/schema/tests; appearance module/component and bounded CSS tokens. Root owns App/routes/auth gate and shared browser adapters. No overlapping builds or automated Git mutations by agents. Commit and push after reviewed plan, navigation/dropdowns, server/shared storage, appearance integration, verified release.

### P14

Requirements: R12, R13, R15, R33, R34, R35, R36, R37, R38, R39, R40, R41. Dependencies: none.

Capture S5, preserve revision9, source/design/account assessment, primary shadcn/Base UI/auth research, concrete design and server/client contracts, independent current-revision critique and pushed checkpoint.

### P15

Requirements: R1, R5, R15, R16, R17, R23, R33, R36, R37, R38. Dependencies: P14.

Pin Base UI1.9.0, create Folio PopoverSelect and migrate all19 consumers plus workspace switcher. Keep App controller ownership, remove topbar, add sidebar footer/settings hash routes, keyboard/portal coordination and no-wrap segmented control. Central installer/build ownership.

### P16

Requirements: R8, R23, R34, R35, R40. Dependencies: P14.

Bounded Better Auth1.7.14 Worker/D1 compatibility spike; use vetted slow hash and database-backed sessions. Configure additive D1 migrations, trusted-owner bootstrap, invitation registration, login/logout/profile/password/recovery and membership checks on all private APIs. Preserve outer Site privacy; do not create production credentials or invite anyone.

### P17

Requirements: R5, R7, R8, R17, R18, R19, R20, R23, R31, R32, R40, R41. Dependencies: P16.

Implement one workspace shared storage service: D1 revisioned metadata, R2 immutable checksummed blobs; atomic manifest/reference publication, expected-revision conflicts, unchanged legacy collection. Browser adapters preserve existing methods and use separate shared caches, hydrate server truth, await server acknowledgement and retain failure data. Explicit reviewed migration preserves local originals, stable IDs, folders, recolor and provenance; retry idempotently. Shared refresh on visibility and bounded polling.

### P18

Requirements: R33, R39, R40. Dependencies: P15, P17.

One typed hex-color palette with current defaults; accent foreground/hover pairs derived, semantic surfaces/text/borders. Appearance draft preview, save/reset through shared settings owner; keep artwork, imported HTML and checker/light/dark preview palettes independent.

### P19

Requirements: R1, R5, R7, R8, R9, R12, R15, R17, R19, R23, R24, R25, R26, R28, R31, R32, R33, R34, R35, R36, R37, R38, R39, R40, R41. Dependencies: P15, P16, P17, P18.

Focused auth/shared-store/UI regressions, actual dropdown and routed-page browser journeys, two isolated member clients, conflict/migration/logout tests, independent code/security/accessibility review and current build/privacy gates. Preserve explicit distinction between fixture and live production credential/inference evidence.

### P20

Requirements: R8, R11, R12, R13, R14, R29, R34, R35, R40, R41. Dependencies: P19.

Document current features/account setup and data ownership. Commit/push milestones with leases, same private Site native-source build/migrations/publication and verification. User enters owner password; a real teammate needs named Site access. Preserve R29 live-companion prerequisite as a separate open goal.

## Scope delta and risks

S5 explicitly replaces top buttons, modal settings and platform-only account handling. Shared persistence is necessary for same-data accounts and is the material backend expansion. No private-media migration is performed by this coding session. Existing Site audience cannot be widened just to make a test pass; a real teammate needs named access. Hash/runtime compatibility and hosted migration/cookie behavior require decisive checks; a successful frontend build is not proof. Preserve all original conversion limits and native-difference claims. No new provider/model capability claims.

## Independent review refinements (pre-admission)

F-R10-01: The existing immutable media cache is incompatible with session revocation. Protected media responses, including HEAD/conditional requests, will use private,no-store; logout removes rendered content and object URLs. Original device-only imports are retained. F-R10-02: Recovery authority is an authenticated owner with current-password step-up for member resets, or the configured trusted Site owner for owner recovery. Generate a single-use recipient-bound expiring reset token, store only its hash, and revoke existing account sessions when consumed. No email or fake delivery.

## Revision11 — S6 login/startup repair

S6 reopens R34/R40 and publication R14. The actual owner has completed registration and has a valid hosted session, but the shared-workspace client invokes native fetch with its class instance as receiver. That fails before HTTP and is masked by arrow-based QA transports. P21 changes only that invocation and adds a normal receiver-sensitive default/injected regression. Preserve all authentication, cookie, origin, timeout, abort, response-size, storage and audience controls. Current request is a repair of existing behavior, not a new login or fallback-auth feature. Existing R29 remains a separate not_run user-local prerequisite.

Decisive completion: the receiver regression fails on8fe1a89, passes after correction, the build passes, the same Site is published, and the real authenticated browser opens the workspace with native fetch. Root owns source/build/deploy. Independent reviewers report only.
