# Revision 10 — UI research and design recommendations

## Provenance and scope

| Field | Value |
| --- | --- |
| Artifact schema | Markdown research report, version 1 |
| Run / stage | folio-revision-10 / research-technical |
| Author | `/root/r10_design_research`, independent research agent |
| Assessed repository head | `bdf73305ff51dcd59c2b7c9a94a66501845ca560` |
| Created / sources accessed | 2026-10-31 UTC |
| Input fingerprint | SHA-256 `58da41d649f2d7d14a9d7ed7d027491451ac31009112cb48d0de6345c7ce5c92` |
| Fingerprint inputs | Concatenated path, NUL, bytes for `package.json`, `src/App.tsx`, `src/styles.css`, `src/components/ai.css`, `src/components/png-svg.css`, in that order |
| Status | Research complete; implementation and browser verification not performed by this agent |

The user requested the existing Folio visual language, a workspace dropdown above sidebar search, a full-height sidebar, a proper Settings page, consistent custom dropdowns, and editable design-system colors. “Shared CDN UI” is interpreted as **shadcn/ui**; that interpretation is an inference. This report applies the workflow researcher, design-system specialist, React frontend specialist, and design-system rollout guidance. It does not change the app, plan, Git history, account architecture, or deployment.

## Decision

Build a **Folio-owned `PopoverSelect`**, styled with Folio's existing CSS and composed from the unstyled `Select` primitive in **`@base-ui/react`**. Use that same wrapper for the new workspace switcher and every existing single-value dropdown. Retain a distinct rich-content popover wrapper for panels containing several controls or commands. This preserves one consistent visual component without assigning listbox semantics to unrelated actions.

The reviewed official Base UI documentation lists **1.9.0**, released **2026-10-09**, as current. It supports React 17 and newer, permits plain CSS, and documents Vite support. Its repository license is MIT. Folio currently uses React/ReactDOM **19.1.1**, Vite **6.3.5**, TypeScript **5.8.3**, Lucide, and plain CSS. There is no existing Radix, Base UI, Tailwind, shadcn, or router dependency. [S6–S9]

The implementation owner should pin the exact installed version and commit the lockfile. This agent did **not** install a package: registry metadata retrieval was unavailable, so the exact npm dependency tree and installation result remain implementation checks. Version and compatibility facts above come from current first-party release and support documentation, not a third-party lockfile.

### Alternatives assessed

| Approach | Fit for this app | Decision |
| --- | --- | --- |
| Folio wrapper over Base UI Select | Headless, plain CSS, controlled value, explicit portal container and positioning; aligns with the current shadcn reference | Recommended; one runtime package, import only required components |
| Install a complete shadcn theme/scaffold | Would introduce styling infrastructure and broad visual changes beyond the requested extension | Do not use the scaffold; borrow documented composition and token principles |
| Handwritten dropdown behavior | No added dependency, but keyboard, focus, typeahead, positioning and modal integration become app-owned correctness work | Acceptable fallback only with the complete contract and browser coverage below |
| Native `<select>` with CSS | Retains native interaction but cannot deliver the specifically requested uniform custom popover | Replace existing consumers |

The current shadcn Sidebar, Select, Popover and Dropdown Menu pages expose Base UI, React Aria and Radix UI variants. The unqualified documentation URLs currently open Base UI examples. The recommendation is scoped to this repository, not a claim that one primitive library is universally preferable. [S1–S4]

## Existing owner and consumer inventory

`src/styles.css` owns the established compact system-font interface and tokens (`--accent`, `--accent-soft`, `--text`, `--muted`, `--line`, `--canvas`). The sidebar is already a flex column with a scrollable middle and footer. `src/components/png-svg.css` adds the 34-pixel top workspace navigation. The new shell should remove that extra row and let the existing sidebar fill `100dvh`.

There are **19 native selects in six files** at the assessed head:

| Consumer | Controls to migrate |
| --- | --- |
| `src/App.tsx` — 6 | Sort files, sidebar image shape, group files, preview width, capture viewport width, capture delay |
| `src/components/CanvasControls.tsx` — 4 | Gallery columns, gallery rows, image shape, canvas sort |
| `src/components/PngSvgWorkspace.tsx` — 3 | Conversion mode, preview zoom, preview background |
| `src/components/AiSettings.tsx` — 3 | Provider, model, reasoning effort |
| `src/components/AiSvgPanel.tsx` — 1 | AI SVG task |
| `src/components/SavedIconsWorkspace.tsx` — 2 | Saved icon zoom, saved icon background |

Preserve current values, numeric conversions, conditional options, disabled options, loading placeholders, callback side effects, ref-based focus, and persistence. Source count alone does not prove migration correctness; inspect rendered controls in all workspaces and dialogs. Existing sort/view/move panels contain actions or multiple controls and should retain suitable rich-popover/dialog semantics while sharing surface styling.

## Layout specification

### Workspace shell

- Keep the existing resizable sidebar width, Finder tree, drag targets, folder behavior, selection logic, and search. Put the workspace dropdown at the top, immediately above search. The closed trigger displays the current section name, its existing icon, and optional unobtrusive count.
- Structure the sidebar as fixed header, independently scrolling tree, and fixed footer. Put the Settings cog in the footer with an accessible name and tooltip; preserve the existing import/status controls there. The official shadcn Sidebar composition supports header/content/footer ownership. [S1]
- Remove the global workspace top bar entirely. The main workspace toolbar begins beside the sidebar, at the top of the right region. Retain the existing mobile sidebar trigger and dismissible drawer behavior.
- Keep Convert and Saved as one compact segmented control. Make each button label and count an inline, nonwrapping unit; let the containing toolbar wrap between controls. A large saved count must not split “Saved” or force horizontal page scrolling.

### Settings page

Settings is an actual route in the existing SPA, not an overlay: a left navigation column, a right content area, a visible return-to-library control, and Logout. Use explicit routes such as `#settings/appearance`, `#settings/ai`, and `#settings/profile` so refresh and browser Back remain meaningful. The existing hash-based workspace navigation can be extended without adding a router solely for these pages.

Render Settings navigation as links with a current-page indication when changing routes. Do not combine link navigation with incomplete `role="tab"` keyboard behavior. Keep tab-like visual styling if desired. The main heading changes with the selected section, and focus should move to it on deliberate page navigation without interrupting form edits.

Use the same compact spacing, buttons, field rows, icons and separators as the library. Preserve AI provider/model/reasoning behavior. Account registration/login/logout and shared data must follow the separate backend architecture decision; an AI provider's identity must not masquerade as the app's signed-in account.

At narrow widths, keep Settings a page and make its navigation available without crushing fields. A compact vertical or wrapping navigation area is sufficient; do not reintroduce the dismissed Settings modal. This page layout is a recommendation derived from the user's request and sidebar composition. The legacy shadcn `/examples/forms` URL returned 404; no unavailable Settings example is treated as evidence. The current sidebar block collection also includes a Settings dialog, which does **not** match this user's explicit page requirement. [S13]

## `PopoverSelect` behavior contract

The wrapper accepts a controlled value, change callback, accessible label, option list, disabled state, placeholder, and optional class/size and trigger ref. Option names must remain meaningful as plain accessible text even when icons, count badges, or descriptions are rendered. Use stable IDs. Avoid nested buttons or links inside listbox options. [S10–S12]

Required interactions:

1. Enter, Space or Down Arrow opens the popup; current selection is discoverable and the relevant option is brought into view.
2. Up/Down move the active option, with disabled choices unavailable for selection. Home/End and typeahead make long model lists practical.
3. An explicit commit chooses the highlighted value. Merely opening or inspecting the workspace/model menu must not switch the workspace or run conversion. Escape dismisses without a new selection and restores trigger focus. Tab continues through the page without trapping focus.
4. Pointer/touch selection commits once; outside interaction dismisses; focus indicators and selected indicators remain visible. Global file-tree and viewer shortcuts must not consume dropdown navigation keys.
5. Use consistent popup spacing and style, trigger-width minimum, viewport collision handling and maximum scroll height. With Base UI, set `alignItemWithTrigger={false}` for predictable below-trigger placement. [S7]
6. Respect active native dialogs. Base UI portals default to `document.body` and accept a `container`. For a select inside Folio's native `<dialog>`, portal into that dialog (or an appropriate descendant). The HTML Standard makes document nodes outside a modal dialog's subtree inert. A large z-index alone does not solve this. [S7, S14]

These are acceptance criteria for Folio's wrapper, not a claim that a library import proves them. Base UI's underlying selected-value and focus behavior must be verified with the concrete wrapper. A custom component still needs correct accessible naming, roles, selection state and focus restoration.

## Appearance settings and token propagation

Use one typed, validated appearance configuration and one CSS-variable application point. Add semantic tokens for application background, sidebar/panel surface, popover surface, main text, muted text, borders, accent, accent foreground, hover and selection. Expose the requested core colors in Appearance; derive secondary hover/selection treatments consistently rather than offering dozens of redundant knobs. The shadcn theming model provides a useful background/foreground token pairing principle, but importing its Tailwind setup is unnecessary. [S5]

Retain the current colors as the reset preset. Provide clear Save and Reset controls, persist through the chosen settings owner, and apply saved values before the main interface paints when practical. Whether appearance is shared workspace branding or an individual preference must be explicit in the implementation; do not accidentally key shared library records by the account identifier while adding preferences.

Validate color strings against a strict color format rather than accepting arbitrary CSS. Preserve readable foreground pairs, visible focus, boundaries and disabled states. Consider derived accent foreground contrast when arbitrary accents are accepted. Replacing the current six variables alone is insufficient: `styles.css`, `ai.css` and `png-svg.css` contain hardcoded white, gray, green, brown and translucent surfaces/states that need semantic ownership.

Keep source images, imported HTML, SVG artwork colors, transparency checkerboards and explicit Light/Dark preview backgrounds independent from app theme colors. Saved SVG recoloring remains its existing artwork operation. App theming must not silently change downloaded files or fidelity comparisons.

## Verification handoff

| Area | Evidence required from implementation/browser owner |
| --- | --- |
| Shell | 1440, 768, 390 and 320 px viewport screenshots; sidebar reaches top and bottom; no old top workspace strip; tree/drag/resizer/mobile trigger intact |
| All selects | No remaining app-owned native select UI; each of 19 migrated consumers plus workspace switcher retains behavior; keyboard and pointer tests, long labels, empty model list and disabled choices |
| Popup nesting | Capture dialog width/delay can be changed; dropdown inside existing rich popover remains visible and operable; Escape dismisses the inner popup first |
| Convert/Saved | Both labels and count remain single-line at narrow toolbar widths and large counts; outer toolbar wraps cleanly |
| Settings | Direct URL, refresh, Back, return-to-library and section navigation work; no Settings modal; visible logout connects to real app account behavior |
| Theme | Default, dark background and vivid accent checks across library, Icons, Settings, dialogs and popup states; Save/reload/reset; no inadvertent artwork/HTML recoloring |
| Data | Existing folders, selections, previews, saved icons and filenames survive navigation/theme changes; account/shared-data verification belongs to its architecture/test owner |

## Sources

All URLs below were accessed on **2026-10-31**. They are first-party documentation, standards or maintainer source. No application browser/render testing was performed for this report.

- **S1 — shadcn Sidebar:** https://ui.shadcn.com/docs/components/base/sidebar — current component composition and primitive variants.
- **S2 — shadcn Select:** https://ui.shadcn.com/docs/components/base/select — value-selection control anatomy.
- **S3 — shadcn Popover:** https://ui.shadcn.com/docs/components/base/popover — rich-content popup composition.
- **S4 — shadcn Dropdown Menu:** https://ui.shadcn.com/docs/components/base/dropdown-menu — actions/menu distinction.
- **S5 — shadcn Theming:** https://ui.shadcn.com/docs/theming — semantic CSS variable and foreground pairing model.
- **S6 — Base UI Quick start:** https://base-ui.com/react/overview/quick-start — package identity, tree-shaking, plain-CSS support and portal setup.
- **S7 — Base UI Select:** https://base-ui.com/react/components/select — controlled wrapper examples, label/value handling, portal container and positioning.
- **S8 — Base UI About and Releases:** https://base-ui.com/react/overview/about and https://base-ui.com/react/overview/releases — React/Vite compatibility and current 1.9.0 release dated 2026-10-09.
- **S9 — Base UI maintainer license:** https://github.com/mui/base-ui/blob/master/LICENSE — MIT; preserve license notices in distribution.
- **S10 — WAI-ARIA Combobox pattern:** https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ — select-only popup interaction and focus/keyboard behavior.
- **S11 — WAI-ARIA Listbox pattern:** https://www.w3.org/WAI/ARIA/apg/patterns/listbox/ — selection versus focus, option semantics, typeahead and Home/End.
- **S12 — WAI-ARIA Menu Button pattern:** https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/ — command menu semantics.
- **S13 — shadcn Sidebar blocks:** https://ui.shadcn.com/blocks/sidebar — shell examples; Settings dialog example explicitly excluded from the page recommendation.
- **S14 — HTML Standard, modal dialogs and inert subtrees:** https://html.spec.whatwg.org/multipage/interaction.html#modal-dialogs-and-inert-subtrees — native modal boundary.

Unavailable checks: the legacy shadcn Forms example returned 404; raw GitHub package metadata and npm registry retrieval were unavailable in this read-only pass. These do not establish installability, transitive package versions, bundle size, or actual browser conformance. The implementation owner should record those outcomes during the planned install/build and functional checks.
