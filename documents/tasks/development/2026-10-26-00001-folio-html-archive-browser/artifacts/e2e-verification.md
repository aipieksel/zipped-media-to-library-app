# Browser verification — revision 3

## Status and evidence ownership

**The observed import, preview, capture, migration, organization, image viewing and compact-layout checks passed. Download verification remains partial; production build and private publication passed.** This document records managed-browser observations supplied by `/root`, the browser operator, on 2026-10-26. `/root/compatibility_fixture` compiled this report without operating a browser or changing application code. It continues the same task and Site through plan revision 3; original-phase evidence is retained where applicable.

The runtime was the managed Sites preview at `http://terminal.local:4173/` in cloud Chromium. Browser actions used the provided browser interface. The application captures HTML with its browser DOM renderer; these checks do not claim server-side Playwright screenshots or cross-browser coverage. The narrow-layout check used an authored 390 × 844 iframe harness, because browser resizing was unavailable.

## T2 / T4 — original HTML, assets and isolation

The original workspace contained **19 HTML pages across four imported roots**: five sample pages, twelve pages from the nested real Library wrapper, two compatibility pages, and an empty CTA archive containing no HTML. The real wrapper contains its outer archive and two unchanged nested ZIPs; its HTML count reconciled at twelve. The current image indexing also identifies 102 image files in this real wrapper.

The real Storage VPS L banner displayed its styles, fonts and image in the live preview, and its capture produced a saved **1440 × 900 PNG**. This is evidence for the inspected banner, not a claim that every export or remote font source was exhaustively checked.

The compatibility index displayed all **13 expected PASS results**:

| Area | Visible results |
|---|---|
| Styles and images | Inline CSS `@import` with a cyclic stylesheet graph completed; linked local SVG loaded; root-relative dynamically assigned image resolved inside the export wrapper. |
| JavaScript and data | Linked classic script, static module chain, literal dynamic import, `import.meta.url` fetch and root-relative JSON fetch executed. |
| Import maps | Nested-module mapping resolved against the document base; the longest matching prefix selected the intended module. |
| Isolation | Parent DOM access was blocked; parent storage access was blocked; isolated page-local storage worked. |

The CSS fixture's expected marker values are text `rgb(26, 102, 72)`, background `rgb(232, 247, 238)`, and a 6px left border. Its cyclic import warning is expected and did not prevent rendering.

Clicking the fixture's bridge probes sent a wrong-channel message and a message from an unrelated nested frame using the current channel. **Neither changed the selected HTML page.** Pressing ArrowDown while its input was focused also kept the selected page. Its local **Open Second page** link selected the matching `Second page.html` identity. These are bounded browser checks of the implemented sandbox and message boundary; they are not a formal security assessment.

An invalid ZIP produced an explicit import rejection while preserving the existing workspace. Earlier HTTP UUID, offscreen capture timing, CSS import/cycle, root-relative resource, module-map and navigation defects were repaired before these successful observations; their history remains in `../results.md` and the review artifacts.

## T3 / T7 — capture and persistence

| Check | Observed result |
|---|---|
| Capture current HTML | The original real banner saved a 1440 × 900 PNG. After the compact redesign, **Capture current** in Settings saved one screenshot successfully. |
| Batch capture | Four sample pages missing screenshots were captured at 768px width; all four completed. The sample-filtered gallery then showed five screenshots. |
| Gallery-to-source identity | **Open HTML** on the Minimal screenshot returned to `Minimal/index.html` with its canonical page ID. |
| Browse during capture | Navigation continued while a two-page compatibility capture batch ran. |
| Cancel capture | Cancelling that batch after the first save reported one saved screenshot and stopped the queue. The completed screenshot remained available. |
| Full-page output | A full-page PNG was downloaded with dimensions **390 × 1803**. |
| Original refresh | Refresh first restored 19 HTML pages, four roots and six screenshots with the same Minimal selection. The subsequent completed compatibility capture brought the original-phase total to seven screenshots. |

The evidence above verifies successful captures and cancellation. A controlled capture failure followed by a successful retry has not been reported in this evidence handoff; it must not be inferred from the separate invalid-ZIP or broken-image checks.

## T7 — additive upgrade and image imports

The revision-3 IndexedDB upgrade preserved **all 19 existing HTML pages and seven existing screenshots**, plus the exact selected Minimal page ID:

```text
a707e106-b3f5-4185-9c59-89e1743255e1/Minimal/index.html
```

The Images view exposed **103 images** already present in the retained archive resources. This was an additive upgrade of the existing browser workspace, not a reset followed by re-import.

Using the native multi-file chooser, root then imported `nested-images.zip`, `direct-badge.svg` and `broken-image.png`. The inventory became **19 HTML pages and 107 images**. The nested image tree showed two images; the direct import group showed two. A known PNG decoded at **390 × 1803**, and the SVG rendered correctly as an image. The intentionally broken PNG displayed an explicit image decoding error. Rendering the SVG did not require inserting SVG markup into the parent document.

## T8 / T9 — favorites, folders and navigation

Root created the user folder **Review picks**, favorited Minimal, and moved it into that folder. The HTML retained the ID shown above and its linked **Explore** JavaScript still worked after the move. Root also favorited `storage-bg.png` and moved it into the same folder. Refresh preserved both assignments and both favorites; the Images gallery with the Favorites filter showed **1 / 1** matching image.

Navigation was checked independently of branch expansion:

- With image branches collapsed, **Previous** wrapped from position 1 to 103 and **Next** returned to 1.
- In HTML mode, navigation wrapped **1 → 19 → 1**.
- ArrowDown on Minimal selected Compact at **2 / 19**.
- The original tree check moved focus to the next selected page with ArrowDown; Left focused its parent, and another Left collapsed the branch.
- Gallery **Open HTML** retained the exact source identity rather than selecting a same-named file elsewhere.

The wrap counts refer to the inventory at the moment of those checks; the later image imports raised the image total to 107. No exhaustive assistive-technology or all-shortcut conformance claim is made.

## T8 — download evidence and remaining uncertainty

The original PNG download completed through a single click. Its downloaded size was **1,393,391 bytes**, and its SHA-256 matched the original image bytes:

```text
60cd557199e85fe896b368439d5ddc12b807edbb1c90982c05f29ab5da5d407a
```

**HTML resource ZIP and SVG download verification remains open.** Browser download waits timed out on HTTP preview using asynchronous, native-anchor and synchronous-button controls, while the PNG control succeeded. The cause is unconfirmed. These timeouts do not prove a browser restriction or a successful file download. HTTPS verification and inspection of the downloaded ZIP members remain pending. The final UI has no added save modal; the evidence does not imply that such a modal is required.

## T6 / T9 — compact shell and focus

The compact shell places navigation in the full-height sidebar and uses one **40px toolbar**. Settings contains the preview/capture controls. The tested narrow harness measured `clientWidth = scrollWidth = 390`, with no document-level horizontal overflow.

At **390 × 844**:

- The closed sidebar was hidden.
- Opening it focused search and set the main region to `inert = true`.
- Escape closed it, restored `inert = false`, and returned focus to **Toggle archive sidebar**.
- The Settings popover measured left **114.3125px**, right **382.3125px**, width **268px**, remaining within the 390px viewport.
- Escape dismissed Settings and returned focus to its trigger.
- A 390px HTML preview rendered at **97% Fit** and passed root's visual inspection.

On desktop with Fit disabled, the 1440px HTML frame's left edge was **256px**, against a canvas left edge of **248px**, with `scrollLeft = 0`. This confirms the actual-size view starts at its left edge with the compact 8px gutter. Re-enabling Fit worked.

## Evidence boundaries and pending completion

T5 production build, source publication and native Sites deployment passed as recorded in the final section. HTTPS HTML ZIP/SVG download checks remain pending because sign-in did not complete. Actual source and schema checks belong to `unit-verification.md` and the independent revision-3 review reports; they are not substituted for browser results here. Archive removal was not part of the supplied browser observations.

Final screenshot artifacts will be attached by root. No screenshot file or final production URL is claimed by this document before those artifacts exist. Imported content remains browser-local, and these observations do not establish cross-device persistence, backend execution, arbitrary hostile-script resource safety or pixel-identical capture of every external asset, embedded video, canvas effect or CSS feature.


## Final publication evidence and boundary

Production build and private native deployment passed. The live URL is https://folio-html-workspace.byronjacobs.chatgpt.site . Build/source commit `ff98d4fa1972b250f882169ed05367ac5d42b742`; deployment `appgdep_6adf9d205d9081919390677cc4625788` returned succeeded. Opening the live Site reached its ChatGPT sign-in gate. Secure sign-in did not complete, and a subsequent exact-origin visit still displayed Log in to access. R15 HTTPS ZIP/SVG delivery therefore remains unverified; this is not an observed HTTPS application failure.

Final screenshots were visually inspected during the original verification.
The binary evidence has since been removed from the public source tree for
collection privacy. Do not restore or republish those captures.
