# Revision 9 — private release and live account verification

Date: 2026-10-31. Coordinator: /root. This addendum follows the independent goal
review; it preserves the earlier pending/failed observations rather than replacing
them with assumed success.

## Published release

- Existing project: `appgprj_6adf889bceb8819185995cc72b70be04`.
- Version: **12**.
- URL: https://folio-html-workspace.byronjacobs.chatgpt.site
- Native Site source: `3727e256a986867ef9ecec416b6ebff0a13d52f4`.
- Deployment: `appgdep_6ae6195e30b881919d645ef81d171f30`.
- Native result: **succeeded**, 2026-10-31T16:38:07.474175+00:00.
- Environment revision: **2**.
- Audience: owner-private. A fresh pre-release get_site showed owner role,
  custom access with the owner only and no groups. The private publication
  operation enforced that audience; no access configuration was changed.
- Existing manifest and R2 binding `BUCKET` are preserved.
- All **108 runtime/build/companion source files**
  compared byte-for-byte with GitHub checkpoint
  `ef4c3c41a4f16f9b90f84f301cd5cf6e4e196dd6`: zero mismatches.
- Native Site checkout is clean after the helper's commit/push/package operation.

The native helper installed the pinned lockfile, built TypeScript and Vite,
embedded 12 frontend assets in the existing Worker, pushed the exact source and
packaged the artifact used by publication. Final main JS is 789.70 kB
(249.35 kB gzip); CSS 54.64 kB (10.98 kB gzip). Only the already documented
mixed-import/large-chunk warnings remained.

The initial native build correctly failed the unchanged repository privacy gate
because three historical screenshot/archive files were still tracked in the old
Site source. They were preserved outside the current package and remain in the
private Site history. The first working-file removal did not clear their index
entries; the next build still rejected them. Explicit Git removal staged the
three exclusions; the final privacy check passed for 323 native source files.
No privacy rule, hook, media exception, collection storage or credential boundary
was relaxed to make the release pass.

The local compressed archive SHA-256 is
`9a3850adece3bea70d85bd5c1154ced4c406801a7f29b9f36b6102f3e490dee3`. The backend reports the uncompressed tar's content hash
`sha256:bc06891ccc1cff792711b4916583a6b4ccc84474ec1166943f96ba1eba6e6c25`; these refer to different archive
representations. Native source/version provenance matches exactly.

## Live production account and application checks

Environment: the user's connected Chrome browser, existing private Folio Site,
normal platform sign-in. No credentials were extracted or entered. No provider
inference was performed.

1. The published Site presented its normal ChatGPT sign-in link. Following it
   exposed the already signed-in account chooser. Selecting the existing owner's
   account returned to the published Folio workspace.
2. Existing HTML/Images/Icons collections appeared. No collection was re-imported,
   cleared or migrated through the server for this check.
3. Workspace menu → Settings → AI showed the actual disconnected controls,
   `Connect to load models`, `Choose a model`, port 8798, pinned Codex setup,
   unsupported-provider descriptions, and disabled Test until paired.
4. Settings → Profile loaded the authenticated name and email from the live private
   endpoint. They matched the selected account; exact identity data is intentionally
   omitted from this public source record. The local display-name preference,
   provider password-reset help and account-security links were visible.
5. Sign out of Folio returned to the private access screen. The normal sign-in
   flow then restored the authenticated workspace. No password was changed.
6. Icons showed the user's existing completed conversions, retained selected mode
   and zoom, shared file sidebar, Convert/Saved toolbar, Save to library and
   Recreate with AI. These read-only checks did not save, recolor, retry or send
   the user's media.

One Playwright settings click/read timed out without opening the modal. A fresh
supported DOM state showed the menu still open; its documented DOM action then
opened Settings normally. This was an automation failure, not counted as a pass
or worked around through hidden application state.

R14, R34 and R35 now have their separate live publication/account evidence.
The earlier reports correctly described those checks as pending at that time.

## Repository integration

Source/test/browser checkpoint `ef4c3c41a4f16f9b90f84f301cd5cf6e4e196dd6`
is the exact remote counterpart of local `add282e32bd4c5675eabc9c19ec8708105303a18`,
tree `d4d45bef627b984e20995e3508242f945be4beb6`. A leased, non-forced main update
from baseline `ca95e01eec08cc9607f3dff3e6693e77785bbe94` succeeded.
The final evidence/checklist closeout commit follows on main and the feature branch;
it changes task records only, so the published runtime source remains exact.

## Remaining required outcome

**R29 is not run:** actual image-to-SVG inference using the user's own ChatGPT
account through their local Codex companion. The browser is authenticated to
Folio, but that is a separate connection from Codex. The user must run the
documented local companion, pair in Settings → AI, select a vision-capable model,
run the text test and then Generate SVG from a selected image. Text testing
alone does not satisfy the image-inference requirement.

R12 overall verified completion remains open because R29 is an explicit requested
outcome. The task record is **blocked on local activation**, with implementation,
repository integration and private publication delivered. This is not a new
permission gate: this environment cannot start the companion on the user's
computer or provide their local login.

Browser/OS file delivery, real OS color-picker interaction, assistive-technology
certification and cross-browser/profile pixel guarantees remain outside the
reported test boundary. Exact saved SVG/ZIP payload tests passed separately.
