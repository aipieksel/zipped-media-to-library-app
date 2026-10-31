# Revision 10 — UI source assessment

## Scope and evidence boundary

Assessed baseline `bdf73305ff51dcd59c2b7c9a94a66501845ca560` for the requested sidebar workspace switcher, common custom dropdowns, unwrapped Convert/Saved controls, page-based Settings and editable interface colors. This is a read-only source assessment. No application files, dependencies or Git state were changed; no browser, build or test was run by this assessor. CSS values and likely failure mechanisms below are source observations, not measurements of a rendered page.

Applied the AI Development Workflow assessor/design-audit contracts and React/design-system specialist profiles. Cloud agent-profile resources were unavailable; the matching installed `3.1.0` profiles were read from the plugin cache. Account registration, server sessions and shared storage are assigned to a separate assessment; this report identifies only the present UI boundary.

## Owner map and constraints

| ID | Scoped requirement | Existing analogue / source evidence | Convention / owner to reuse | Plan constraint / verification |
|---|---|---|---|---|
| C1 | Full-height sidebar with workspace selector above Search | `src/App.tsx` renders a 34px `.workspace-navigation` sibling before `.app-shell`; `png-svg.css` owns that outer layout, while `styles.css` owns sidebar height, drawer and resizer | Keep the existing App sidebar, ArchiveTree, search, footer and toolbar; replace navigation placement | Removing only the tab buttons leaves the 34px bar. Remove its layout reservation, move necessary actions to the sidebar, and verify sidebar top is viewport top at desktop and mobile sizes. |
| C2 | One custom dropdown for all selections | 19 native `<select>` instances, inventoried below; no existing common Select component or UI-library dependency | Add one reusable controlled selection component using existing fonts, borders, radii and density | Preserve typed numeric/string values, disabled options, asynchronous catalog reconciliation, labels and trigger refs. Source scan should find no remaining application native select. |
| C3 | Dropdowns work inside existing popovers and dialogs | App popover effect uses document `pointerdown`, `closest([data-popover-root])`, Escape and Tab trapping; panels are overflow-auto. `Modal.tsx` uses native `dialog.showModal()` | Common popover behavior must coordinate with App's existing owner and dialog top layer | Portaled child options must not look like an outside click to their parent. Escape should dismiss the active child first. A child in the capture dialog must remain visible above that native dialog. |
| C4 | Convert/Saved never wraps | `IconViews.tsx`; `.mode-switch button { flex:1 }` in `styles.css`; `.icon-view-switch` in `ai.css`; wrapping conversion toolbar in `png-svg.css` | Fix atomic button/group sizing in `.icon-view-switch` | Preserve labels/counts and allow toolbar controls to reflow as whole controls. Verify nonempty Saved and large counts at narrow widths; do not hide the count merely to pass. |
| C5 | Settings is a real navigable page | App owns `settingsOpen`, `settingsTab`, `hashTab`, `switchTab`, `navigationRevision` and all collection/AI controllers. Current Settings is a `<Modal>` with AI/Profile tabs | App remains the lifecycle owner; page UI can reuse AiSettings/ProfileSettings sections | Add route/deep-link/back behavior without remounting or resetting collections, saved selection, active imports or AI state. Closing/returning must restore the last workspace. Existing `#png-to-svg` alias remains meaningful. |
| C6 | Settings navigation and logout | Current AI/Profile tabs are horizontal modal tabs; `ProfileSettings.tsx` fetches `/api/account` and exposes ChatGPT sign-in/sign-out links | New page has left navigation and main content; separate account implementation owns session actions | Do not present current ChatGPT identity/local display name as app-account registration. Logout must be a real session operation. Coordinate empty/loading/error/profile states with the auth owner. |
| C7 | Editable accent, background and design colors | Six root semantic color variables in `styles.css`; five CSS files contain substantial literal colors | Extend the existing semantic tokens and persist one validated appearance preference through the established preference layer | Changing only `--accent` and `--canvas` leaves hardcoded white panels and orange selection states. Apply color roles consistently without recoloring imported HTML, source images, SVG artwork or fidelity preview backgrounds. |
| C8 | Keyboard/focus survives removal of tabs and native selects | App file shortcuts exclude `input,textarea,select` but not custom selection controls. Modal initial focus queries `input,select,[role=tab][aria-selected=true]`; modal and icon-delete fallbacks target the removed top tabs | Shared focus semantics and an explicit workspace-switcher trigger | Custom controls must consume navigation keys or be excluded by file shortcuts. Settings must disable file navigation shortcuts. Update focus fallbacks to connected visible controls and preserve focus on Convert/Saved replacement. |
| C9 | Shared tree/import/AI flows are preserved | App chooses library/icon projections and drop handling by active workspace; hooks remain App-owned; Icons import switches to Convert and persists source/folders | Existing ArchiveTree, import handler and icon collection controller | Settings must not accidentally import into a hidden workspace on drop. New selector still invokes the existing workspace switch logic and preserves each workspace's remembered selection/preferences. |
| C10 | Evidence remains usable after navigation changes | `tests/icon-collection-browser-check.ts` and `tests/png-svg-browser-check.ts` find `.workspace-navigation` tabs | Update existing browser harness navigation helpers and add focused interaction evidence | Old selectors silently observing no selected tab are not proof. Capture active workspace through the new trigger/selected option and exercise saved/convert persistence, dropdown focus and routed Settings. |

## Complete native selection inventory

Line numbers identify the assessed baseline, not later edits. There are **19 instances across six components**.

| Owner | Labels / values | Important behavior to retain |
|---|---|---|
| `src/App.tsx:580–582` — 3 | Sort files; Sidebar image shape; Group files | Name/date sort plus largest/smallest only for Images; shape only for Images; folders/month/all grouping; persist existing order state. These selections are nested inside Sort and group files popover. |
| `src/App.tsx:642` — 1 | Preview width | 1440/1920/768/390 converted to a number; nested in View and capture settings popover. |
| `src/App.tsx:688` — 2 | Viewport width; Loading delay | 1440/1920/768/390 and 500/1000/2500/5000ms, wrapped labels inside native capture dialog; options update numeric capture configuration. |
| `src/components/CanvasControls.tsx:12–16` — 4 | Gallery columns; Gallery rows; Image shape; Canvas sort order | Auto is numeric zero, grid values 1–8; image-only shape and size sorting; changes must retain current grid/sort persistence. |
| `src/components/PngSvgWorkspace.tsx:93–95` — 3 | Conversion mode; Preview zoom; Preview background | Pixel vectors/smooth curves/embedded bitmap distinctions; mode change is asynchronous and trigger has a ref; fit/1/2/4 zoom and checker/light/dark background persist through icon preferences. |
| `src/components/SavedIconsWorkspace.tsx:67–68` — 2 | Saved icon zoom; Saved icon background | Same preview values in saved workflow, separate from artwork recoloring. |
| `src/components/AiSettings.tsx:24–29` — 3 | AI provider; AI model; AI reasoning effort | Codex/Grok/disabled DeepSeek; actual provider model catalog, busy/no-catalog disabled states, unavailable placeholder and model-supported efforts; provider change reconciles model and effort. Model trigger ref receives focus after connection. |
| `src/components/AiSvgPanel.tsx:115` — 1 | AI SVG task | Recreate/clean SVG; clean disabled without current SVG; all disabled while busy. |

Existing non-selection popovers are App's **Workspace menu**, **Sort and group files**, **Move to folder**, and **View and capture settings**. They share `.toolbar-popover` styling but are hand-rendered from App's `popover` state. The sort/view popovers contain multiple controls; they require a reusable popup shell rather than being coerced into a single-value listbox. The two native `<details>` controls—fidelity/storage information and companion setup—are disclosure content, not selection dropdowns.

## Layout and wrapping findings

The current shell is a flex column with a 34px global navigation row. `.folio-app > .app-shell {height:auto;flex:1;min-height:0}` allocates the remainder to the workspace. The sidebar itself already uses full available height, a fixed header/footer and a scrollable middle. The shared sidebar and desktop pointer/keyboard resizer are therefore the correct extension points; a replacement Icons-specific sidebar would break the established ownership.

Convert/Saved inherits `.mode-switch button {flex:1}` and has no nowrap or min-content protection. Saved is text followed by a separate count span, leaving a normal line-breaking opportunity. Its icon-specific rule changes padding and height without closing that opportunity. The conversion toolbar itself already wraps. This supports fixing the button/group as an atomic inline layout while keeping toolbar reflow; the exact failing width must still be reproduced in browser.

At `max-width:650px`, the sidebar is a fixed drawer with top/bottom zero, a scrim, hidden/translated closed state and main-content `inert` while open. Keyboard focus initially goes to Search. The drawer keydown capture handler can consume Escape before a child dropdown sees it, so nested menu behavior requires explicit coordination. Settings needs responsive navigation that remains reachable independently of the library drawer.

## Color ownership and theme completeness

The current root colors are `--accent:#b94c2d`, `--accent-soft:#fcf0e9`, `--text:#252a2d`, `--muted:#626c69`, `--line:#e4e7e5`, and `--canvas:#f3f4f2`. The body/root and numerous surfaces also use literal white. A source inventory found 299 literal color occurrences across the following files; occurrence counts include semantic statuses and intentional preview colors, so indiscriminate replacement is inappropriate.

| Stylesheet | Literal color occurrences | Main ownership |
|---|---:|---|
| `src/styles.css` | 135 | Root tokens; app shell/sidebar/toolbar; controls; tree; popover; modal; shared states |
| `src/components/collection.css` | 62 | Shared tree and gallery presentation |
| `src/components/png-svg.css` | 45 | Current global navigation; conversion toolbar, result panels and previews |
| `src/components/images.css` | 31 | Image gallery/viewer/grid controls |
| `src/components/ai.css` | 26 | Settings/profile, AI panel, saved icon color toolbar, Convert/Saved |

Expected reusable color roles include accent/on-accent/soft-accent, page canvas, primary/secondary surfaces, fields/hover/selection, text/muted text, borders and focus ring. Preserve the existing palette as defaults. Success/warning/error states need independent legibility; asset checkerboards and explicit light/dark preview planes convey transparency and should retain their chosen preview semantics. Imported HTML renders in its own document; source image/SVG bytes and saved artwork colors are not interface-theme inputs.

## Required runtime evidence, not performed here

- Desktop, 650px boundary, 390px and 320px: sidebar begins at viewport top; workspace selector is above Search; every workspace remains navigable; Settings cog is reachable; controls do not overlap or clip.
- Convert/Saved in both views with zero, nonzero and large saved counts: each button occupies one line and focus survives switching; toolbar can reflow without horizontal page overflow.
- Each common dropdown: current value, mouse selection, Enter/Space, arrows, Home/End, Escape, focus return, disabled option skipping and long labels. Verify dependent model catalog/effort updates and empty states separately.
- Nested dropdowns inside sort/view popovers and native capture dialog: correct stacking, outside-pointer dismissal, single-layer Escape, no accidental parent dismissal on selection and no background file navigation.
- Direct Settings route, AI/Profile/Appearance navigation, browser Back/Forward, reload and return to previous workspace: retain controllers, source/library records, selected item, saved view and pending work; verify live account states with the auth implementation.
- Appearance save/reset/reload across shell, tree, dropdowns, all Settings tabs, dialogs, gallery and icon toolbar: current token values persist, borders/text/focus remain distinguishable, and source/output asset bytes and preview modes do not change.

These checks belong in the parent's existing acceptance record. This source assessment does not establish a visual, accessibility, authentication or runtime pass.
