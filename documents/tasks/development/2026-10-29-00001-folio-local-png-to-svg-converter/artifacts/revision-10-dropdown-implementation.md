# Revision 10 — P15 delegated dropdown implementation

## Scope

Implemented the admitted P15 dropdown work under the coordinator's existing execution admission. The coordinator owns App's six select consumers, workspace selector, shell/routes, package installation, parent event guards, build, Git and deployment. This change is not an assertion that all P15 or T26 outcomes have passed.

## Changed files

- Added `src/components/PopoverSelect.tsx` and `src/components/popover-select.css`: one Folio-styled wrapper over the centrally installed Base UI 1.9.0 Select.
- Migrated the 13 selections in `CanvasControls.tsx`, `PngSvgWorkspace.tsx`, `SavedIconsWorkspace.tsx`, `AiSettings.tsx` and `AiSvgPanel.tsx`.
- Updated `Modal.tsx` initial/fallback focus for custom select buttons, hidden inputs and removed global tabs. Native dialog cancellation yields while a child select remains open.
- Updated `IconViews.tsx` and added `icon-views.css`: buttons and counts remain atomic, nonwrapping units; button type is explicit and the containing toolbar can still reflow.

No existing CSS file was edited by this delegate. New CSS uses the appearance owner's agreed semantic variables with current-palette fallbacks. No package, application storage, account, routing or source-artwork logic changed here.

## Component contract

`PopoverSelect` accepts a controlled string/number `value`, `onValueChange(value: string)`, and `options: readonly {value: string | number; label: string; disabled?: boolean; icon?: ReactNode; count?: number}[]`. It supports `aria-*`, an accessible `label` fallback, `name`, `id`, `disabled`, trigger `className`, `placeholder`, `title` and an `HTMLButtonElement` ref. Values are normalized to strings at the boundary, preserving numeric-zero Auto choices. Missing values render the supplied placeholder; the wrapper does not silently choose an available model or first option.

The wrapper uses a nonmodal Base UI Select with collision-aware fixed positioning and `alignItemWithTrigger={false}`. Its portal container is the trigger's closest native dialog where present. Selection is committed only on an enabled item's activation, so opening/highlighting/closed-trigger typeahead cannot trigger conversion or workspace changes. Open-state keyboard/typeahead behavior remains Base UI-owned; the wrapper stops bubbling workspace shortcuts without cancelling Tab.

The model and mode refs now use `HTMLButtonElement`, retaining existing programmatic focus calls. Dynamic model catalogs, unavailable placeholders, disabled providers, model-specific reasoning, conditional image sort options, async conversion and persisted zoom/background callbacks retain their existing consumer logic.

### Coordinator integration hooks

- `[data-folio-select-trigger]` identifies each trigger; `data-value` contains its normalized current value.
- `[data-folio-select-popup]` identifies the portaled option surface.
- `isFolioSelectPopupOpen(root?: ParentNode)` checks for an expanded trigger in a scope or document.
- `isFolioSelectEvent(event: Event | SyntheticEvent)` checks the native composed path for triggers/options, including portals.

The coordinator must apply these hooks to App's global shortcuts, rich-popover dismissal/Tab handling and the mobile drawer's capture-phase handler. Trigger-level event stopping cannot supersede an earlier document capture handler. The modal focus fallback recognizes an optional `[data-workspace-switcher]` marker, then other visible custom triggers/mobile menu controls.

## Actual verification

1. A focused TypeScript program used the repository's parsed compiler options and the eight changed TSX components plus the existing PNG trace declarations. It traversed their imported dependencies without emitting files. Final result: **zero diagnostics, exit 0**. This was not the full repository build.
2. A TypeScript AST inventory of the five migrated consumers found **13 PopoverSelect instances, each with its original accessible label, and zero native selects**: CanvasControls 4, PngSvgWorkspace 3, SavedIconsWorkspace 2, AiSettings 3, AiSvgPanel 1.
3. `git diff --check` on the modified existing TSX files returned **exit 0**.
4. Installed Base UI type declarations and implementation were inspected for portal container support, string-controlled values, event reasons, item activation, nonmodal focus management, positioning variables and state attributes. No compatibility was inferred from a component name alone.

## Pending coordinator evidence

Browser rendering, pointer/keyboard/typeahead, Escape/Tab/focus return, nested popover/native-dialog behavior, disabled/dynamic models, mobile widths and large Saved counts are **not run by this delegate**. The wrapper's actual behavior must be checked alongside App's new capture and popup guards. App's six migrations and the workspace selector are outside this delegated edit set. No broad tests/build, Git mutation, account creation or deployment was performed here.
