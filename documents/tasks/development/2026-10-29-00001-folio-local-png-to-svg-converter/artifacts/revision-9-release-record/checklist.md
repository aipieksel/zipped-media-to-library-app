# Folio AI amendment — revision 9 checklist

Prior release evidence is retained in artifacts/revision-7-release. Affected outcomes are reopened; unchanged conversions retain their verified state. New AI/account claims require their own evidence.

- [x] R1 — Use the exact existing Library sidebar, search and tree for Icons, preserving familiar controls.
- [x] R2 — Keep editable merged pixel geometry as the default exact-native conversion.
- [x] R3 — Preserve native dimensions, transparency and antialiased edge pixels in pixel mode.
- [x] R4 — Retain clearly labeled original-byte embedded PNG mode.
- [x] R5 — Support batch import, responsive interactions, bounded conversion and useful failure recovery.
- [x] R6 — Show aligned original and actual SVG previews at native size and enlarged sizes.
- [x] R7 — Provide individual and ZIP downloads with safe unique source-based filenames.
- [x] R8 — Keep ordinary conversion and stored media device-local; send only explicitly selected AI inputs through the paired CLI to the selected provider; keep private media and credentials out of GitHub.
- [x] R9 — Independently render each downloaded SVG at native dimensions; verify only zero visible RGBA differences and otherwise show the count.
- [x] R10 — Test opaque, transparent, partial-alpha, antialiased, palette and multicolor PNGs, including new tracing regressions.
- [x] R11 — State scaling, approximation, color-reference and tested-browser limits honestly.
- [ ] R12 — Use the selected workflow phases and real independent review, then complete verified implementation.
- [x] R13 — Commit and push each meaningful milestone frequently.
- [x] R14 — Publish the verified revision to the existing owner-private Site.
- [x] R15 — Move HTML and Images to top navigation and add Icons alongside them.
- [x] R16 — Place conversion mode and preview controls in the canvas toolbar; remove the separate converter sidebar/drop-zone.
- [x] R17 — Accept file and directory drops on sidebar or canvas and preserve nested folder structure.
- [x] R18 — Place loose PNGs into a persistent default Uncategorized folder.
- [x] R19 — Persist original icons, folders and completed results locally across navigation and reload.
- [x] R20 — Automatically convert newly imported PNGs after durable import and recover interrupted queued work.
- [x] R21 — Research current image-to-SVG repositories and methods deeply using primary sources and select an implementable local approach.
- [x] R22 — Implement a researched smooth-curve option for scalable artwork and measure its actual native error without weakening exact mode.
- [x] R23 — Preserve existing HTML/Image Library data, backend contracts and interactions.
- [x] R24 — Support static WebP-to-SVG alongside PNG throughout the same Icons workflow, retaining original bytes and truthful native fidelity checks.
- [x] R25 — Integrate the supplied package as a shared AI service using locally authenticated OpenAI/Codex, reusable by Icons and future Images/HTML features.
- [x] R26 — Recreate or clean up the selected icon as an editable SVG with AI on the existing conversion page; review and save the result without replacing the source conversion.
- [x] R27 — Use a source-aware SVG reconstruction prompt that preserves the design, proportions, dimensions, transparency and colors; report actual fidelity without promising universal perfection.
- [x] R28 — Provide persistent AI provider, model and reasoning settings with honest supported-provider and connection states.
- [ ] R29 — Test a real image-to-SVG request using the user’s own OpenAI account; distinguish it from mocks, catalog discovery and app sign-in.
- [x] R30 — Make selected original Images accessible to the shared AI workflow now, with a working image-to-SVG action and an extensible capability contract for later image editing.
- [x] R31 — Allow explicit saving of chosen conversion or AI results into a durable icon library independent of temporary conversion results.
- [x] R32 — Recolor saved vector icons, persist the selected color, and download individual or ZIP SVGs containing that same color.
- [x] R33 — Add a compact global menu and Settings with AI and Profile tabs using the established components and shared sidebar.
- [x] R34 — Expose real account sign-in/sign-out through the existing Site authentication boundary.
- [x] R35 — Show the authenticated profile and profile preferences, with accurate password/security management through the account provider.

## Revision 9 evidence boundary

Checked implementation rows are supported by the unit, independent review and
native browser/fixture reports. R7/R32 verify current SVG and ZIP payloads;
browser/OS delivery remains unverified after an automation timeout. R25/R26/R30
verify the shared application/companion path with declared fixtures, not real
provider inference. R14 is published as private Site version12. Live ChatGPT
sign-in, authenticated Profile and sign-out/sign-in now pass for R34/R35; see
artifacts/revision-9-release.md, which supersedes the earlier pending status.

R29 remains open: real image inference requires the owner's running, signed-in
local Codex companion. R12 overall verified completion stays open until R29 passes.
Implementation and publication are delivered; the remaining state is local
activation and live-user verification. No admission hashes were restamped.
