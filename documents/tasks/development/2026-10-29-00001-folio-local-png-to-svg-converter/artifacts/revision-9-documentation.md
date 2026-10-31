# Revision 9 — documentation update

Updated README.md, PRIVACY.md, companion/README.md and THIRD_PARTY_NOTICES.md
against the implemented behavior. Setup is available in the AI Settings UI and
the repository. The release pins the official CLI compatibility check to 0.166.0;
later CLI changes are not silently treated as tested.

The documentation distinguishes ordinary local conversion from explicit provider
transmission, Site login from Codex login, temporary pairing from provider
credentials, fixture tests from real inference, and saved browser storage from
permanent/cross-device storage. It explains the original-byte embedded exception,
recolor/reset fidelity behavior, safe current-variant exports, input/output limits
and unsupported Grok/DeepSeek/raster-editing capabilities.

The supplied AGPL-3.0-only source package remains in the repository with its
license and modification notice. New pinned dependency notices are included in
the app source and companion distribution. Existing attribution text is preserved.

The full 35-row checklist remains visible in the record and final user handoff.
R29 real user-account inference and R34/R35 live signed-in account checks remain
open; overall completion R12 is not claimed. The private publication result is
recorded separately after the release. Admission hashes are not restamped when
verification checkboxes change.

Independent final documentation review identified D1: old capture/import instructions
referred to Settings after the new global AI/Profile settings was added. README
and in-app Help now name the existing View and capture settings control. This
changes instructions only; capture/import behavior is unchanged.


## Coordinator release addendum — 2026-10-31

The later [revision-9-release.md](revision-9-release.md) records successful private
version12 publication and real connected-browser ChatGPT sign-in, authenticated
Profile, sign-out and sign-in again. R14/R34/R35 are now verified. Earlier pending
observations above remain the accurate record of when this report was written.
R29 real local-account image inference and therefore R12 overall completion remain
open. No fixture or Site sign-in is represented as a Codex inference test.
