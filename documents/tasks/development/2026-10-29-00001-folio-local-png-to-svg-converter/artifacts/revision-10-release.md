# Revision 10 — release receipt

## Published result

The existing owner-private Site published **version13** successfully:

- URL: https://folio-html-workspace.byronjacobs.chatgpt.site
- Project: `appgprj_6adf889bceb8819185995cc72b70be04`
- Saved version: `appgprj_6adf889bceb8819185995cc72b70be04~appgver_de10d6148abc8191a2eff1716c9ec53a`
- Deployment: `appgdep_6ae64f1cafa48191b7f011d3f24a0e85`
- Terminal result: `succeeded`, no failure message
- Published at: `2026-10-31T20:27:28.680341+00:00`
- Runtime environment revision: **3**
- Pushed native source: `d0bb3ed4a2c7a5fbdfa8bc4263f34f7508cb7052`
- Matching GitHub checkpoint: `c27d0a9f81052fbf2f0f4415172c6c6c55f7f912`
- Deployment archive SHA-256: `49214e09eaae697395af966eecc74293477ce0015d0e6f105f15b7c93d0ed029` (1,012,593 bytes)

The official Site workflow built, committed, pushed and packaged the source before publication. Its TypeScript/Vite/Worker build and Git-index privacy scan passed. The archive includes the additive D1 migration and journal. All **136 runtime/build/companion/database/CI files** selected for comparison match GitHub and native source byte for byte. The existing R2 binding and private audience are preserved; fresh Site readback reports version13, the owner role, custom access with only the owner and zero external visitors.

The native dependency installer first encountered sandbox `EPERM` in esbuild's child-process version check. The sanctioned installer rerun succeeded. No dependency, privacy or build check was disabled. The successful build retains the documented main-bundle/mixed-import warnings.

## Production readback

The connected-browser initialization did not finish and was stopped after waiting. No owner password, registration, invitation or browser session was fabricated. A read-only verification used the Site's documented service-access header, sent only to this Site with redirects disabled. That capability supplies **no visitor identity** and no Folio session:

| Request | Actual result |
| --- | --- |
| `GET /` | HTTP200; Folio HTML contains the exact new frontend asset `index-Dbky8qzf.js`; `private, no-cache` |
| `GET /api/folio-auth/session` | HTTP200 JSON; `authenticated:false`, `setupRequired:true`, `canBootstrap:false`, `canRecoverOwner:false`, no account; `private, no-store` |
| `GET /api/workspace/documents/icons` | HTTP401; `private, no-store` |

The false bootstrap flag is the expected result for service access without the trusted owner's visitor identity. These responses establish that the deployed Worker initializes, the D1 account schema is readable, owner setup remains unclaimed, and service access alone cannot read the shared workspace. They do **not** establish a visual owner-bootstrap screen, an actual hosted password login or the owner's production cookie. The existing authenticated owner must open the Site and choose their own Folio password.

## Checkpoints and concurrent work

Revision10 checkpoints were pushed throughout: reviewed plan `235634e`, UI primitives `6e38c59`, native account/shared services `c8eb8a4`, integrated UI/persistence `6c0f38b`, regression/review `52d0250`, and final browser/docs `c27d0a9`.

A concurrent remote CI commit `0d843c6ef9711ee513983b1a87af7cf6712c720d` appeared before the final push. The first connector ref update failed; remote readback identified that change. The local unpushed checkpoint was rebased onto it and the final tree `f500b33b09bc0a5d3a5404a246b81d22df0a5b65` was checked before a leased, non-forced update. The Node22/24 CI workflow was preserved in both repositories. Its definition is not claimed as a successful hosted CI run.

After successful publication and bounded production readback, `main` advanced from `bdf73305ff51dcd59c2b7c9a94a66501845ca560` to `c27d0a9f81052fbf2f0f4415172c6c6c55f7f912` with an expected-head lease and no force. Direct remote readback confirmed both main and feature refs at that release checkpoint. A final documentation-only checkpoint follows without changing the published application files. A bounded GitHub Actions lookup for the release checkpoint returned no associated runs; no hosted CI success is claimed.

## Activation and limits

- **First owner:** open the existing private Site while signed into its owner account. Create the separate Folio account with name, email and a password of12–128 characters. Credential entry/submission must be performed by the owner.
- **Teammates:** the owner can create recipient-bound, single-use Folio invitations in Settings → Accounts. A teammate also needs access to the private Site. No teammate was identified, no Site audience was expanded and no invitation email was sent.
- **Existing device files:** Settings → Workspace inventories the preserved old browser databases before an explicit copy into shared storage. Existing curated server media remains in its original storage. Removing an active entry does not erase retained immutable server chunks.
- **AI:** the Folio account does not authenticate the local Codex companion. RequirementR29, an actual image request using the owner's OpenAI/Codex account, remains not_run. Prior deterministic integration checks do not substitute for it.
- Native UI/storage/Worker results and limitations are in `revision-10-verification.md`. One prior optional private-Library case remains skipped; the browser SVG download-event timeout does not certify operating-system delivery. No universal browser/color-profile claim is made.

The published application is delivered. The overall accumulated task remains open only for explicitly unperformed activation/verification outcomes; checkpoint boxes must follow their individual evidence.
