# Accessibility verification — static scope

Reviewer: `/root/fidelity_research` under GVA, independent of the UI implementer. Date: 2026-10-29. Reviewed App navigation, converter component, new CSS and inherited focus/layout rules. Root owns actual keyboard, mobile and browser observation. This document is source/contrast evidence only and does not claim screen-reader testing or WCAG conformance.

Initial verdict: **two bounded medium findings need repair/verification**. No redesign is needed.

## Findings

### A1 — medium — new small empty-state text falls below normal-text contrast

Source: `src/components/png-svg.css` `.png-list-empty` / `.png-list-empty>span` and `.png-empty-notes` (initial lines 20 and 26).

Calculated declared sRGB contrast using the standard relative-luminance formula:

| Text | Foreground | Background | Ratio |
| --- | --- | --- | --- |
| Drop a batch anywhere in this tool | #849080 | #ffffff | 3.34:1 |
| Original dimensions / Transparency preserved / Rendered pixel check | #77836b | #f3f4f2 (--canvas) | 3.63:1 |

These are 9–10px informational text, not disabled controls or large text. Both fall below the 4.5:1 normal-text threshold relevant to WCAG 1.4.3. The existing `--muted` value #626c69 produces approximately 4.92:1 on the canvas and is already the normal secondary-text token.

Minimal repair: use `var(--muted)` for these text selectors; decorative symbols may retain their existing colors. Recheck declared and rendered backgrounds after the change. Status: open at initial review, sent to root.

### A2 — medium — disappearing action controls lack focus recovery

Source: `src/components/PngSvgWorkspace.tsx` removeItem (initial lines 168–177), retry, and conditionally rendered Stop/Retry controls.

The remove handler updates selection but deletes the focused Remove button without restoring focus. Retry/Reconvert and selected-item Stop likewise disappear when their status condition changes. Source inspection predicts that keyboard users can lose their position and return to document-level focus. This is a focus-continuity risk relevant to WCAG 2.4.3/2.1.1; an actual browser check is needed to record the observed behavior rather than declare a formal criterion failure from source alone.

Minimal repair: if the disappearing control held focus, restore focus after the React commit to the appropriate persistent queue selection button (next/previous item for removal; the same item for stop/retry), or to Add PNGs when no items remain. Avoid moving focus when unrelated processing finishes while the user is elsewhere. Check auto-completion while Stop is focused as well. Status: open/source-predicted at initial review, sent to root for runtime confirmation and scoped repair.

## Source checks with satisfactory design

- Workspace navigation is a labeled native `nav` with native buttons and accurate `aria-pressed` active state. It does not claim the ARIA tabs pattern, so no missing roving-tabindex/arrow-key contract is implied for these two buttons. Existing Library tab implementation is unchanged.
- The converter uses an actual `hidden` attribute with an explicit `.png-workspace[hidden]{display:none}` rule. Its controls are therefore excluded from ordinary focus/rendering while Library is active. Library content is unmounted when converter is active, eliminating hidden collection tab stops.
- Existing App keyboard handlers now exit when `workspace !== 'library'`. Navigation closes collection popovers and mobile drawer state. Converter import/drop events are owned by its own workspace.
- Native selects have programmatic names: Conversion mode uses an explicit label, and Preview zoom/Background have surrounding labels and descriptive aria-labels. Native select arrow-key behavior is not intercepted by converter code.
- Import via drag/drop has multiple keyboard-operable button alternatives, all triggering the PNG file input. Icon-only Add/Remove/Download/Dismiss controls have accessible labels; queue selection buttons include original filename text and `aria-pressed` state.
- Main preview and batch sections have landmark labels; original and SVG images have distinct descriptive alt text. Visible mode text explicitly distinguishes bitmap output. Errors and fidelity are textual, not conveyed only by green/orange icons.
- Progress/result and notice regions use polite status semantics. Hidden converter updates are not expected to announce in Library mode. Real assistive-technology verbosity and announcement behavior remain untested.
- Inherited global `:focus-visible` rules supply an accent outline on buttons and selects; the details summary has an explicit focus-visible rule. No new code globally removes these outlines. Original text stays available to accessible names despite visual ellipsis.
- Existing Library sidebar width remains controlled by the unchanged `--sidebar-width` source and resizer. New navigation consumes 34px vertically; `.folio-app>.app-shell` uses the remaining flex height. Converter sidebar rules are separately namespaced. Mobile library drawer is offset by 34px rather than changing the stored width.
- New narrow-screen rules stack the queue and preview panels and wrap toolbar/actions at 650px. Min-width:0 and minmax(0,1fr) contain the comparison columns. The overall minimum width is 320px. Actual overflow, focus clipping and page zoom are not proved by these declarations.
- Existing reduced-motion styling remains effective for converter spinners/transitions. Images use preview zoom independently of actual output size.

## Focused browser checks for root

1. Tab to PNG to SVG, activate with Enter/Space, verify pressed state and continued visible focus; switch back and ensure converter controls are absent from the Tab sequence. Confirm selected Library item, filter/grid and sidebar width survive.
2. Use only the keyboard to add fixtures, select queue items, change both conversion modes and native preview/background selects, download SVG/ZIP and open/close the fidelity details.
3. Focus Remove for a middle, last and sole item; verify focus lands on the expected remaining queue control or Add PNGs. Repeat with keyboard Retry/Reconvert and Stop, including a completion that removes Stop while focused.
4. Navigate through a 390px viewport and at real page zoom, not merely image zoom. Confirm actions/focus outlines remain visible and the page does not require horizontal scrolling to reach essential controls. Scroll large native-size preview surfaces by keyboard where supported.
5. Observe success, nonzero difference, unavailable verification and malformed-input states. Confirm readable text and no false verified announcements. Screen reader behavior, high-contrast modes and other engines remain explicitly untested unless separately exercised.

## Initial source hashes

| File | SHA-256 |
| --- | --- |
| src/App.tsx | `86eecd9d287f160e6123dfa5b8ddb1a67139a8b3a36e9c4791b61d3617540572` |
| src/components/PngSvgWorkspace.tsx | `d29511e97c57a314734a6ab254bbd0b379df462cdd6f8ededbf7b7fe1d4b196b` |
| src/components/png-svg.css | `515b0f49b5c29fc7c4324e158f9a04ddcec74dcbd8a9c1ffebbd98a3a5186b3c` |

Read-only procedures: source inspection, line-number lookup and local relative-luminance calculation. No application edits, tests, browser actions, commits or builds were performed by this reviewer.

## Focused repair readback

**A1 resolved in source.** `.png-list-empty>span` and `.png-empty-notes` now use the existing `var(--muted)` text token, giving at least approximately 4.92:1 against their declared backgrounds. Decorative icons retain their original appearance.

**A2 action-driven transitions repaired in source.** The component maintains refs for persistent queue-selection buttons and Add PNGs, with a post-render focus target. Removal checks whether the removed row contained focus and then selects the adjacent surviving queue control or Add PNGs. Clear, Retry/Reconvert, selected-item Stop and Stop batch set an appropriate persistent target before changing item state. Ref callbacks remove obsolete nodes from the map. These are suitable scoped fixes; actual keyboard behavior remains root-owned verification.

One focused A2 edge remains for readback/runtime verification: if focus is resting on the selected-item Stop button and the job completes or errors asynchronously, that button disappears without the current success/error handlers requesting recovery. Guard any repair by the focused control's job identity so background completion never steals focus from unrelated controls.

Repaired-source hashes at this readback:

- PngSvgWorkspace.tsx: `925c35b7a481afc6ec7537a8dc5324bf368ef92768fa85892e512fa34ef4486a`.
- png-svg.css: `4b77b724cf76b1408fbea85a7b7b67690060bfc2bf7371444f6b10aaf47c44f5`.

Static verdict: A1 closed; A2 has the single automatic-completion focus edge described above. No additional material semantic/layout finding was introduced by these repairs.

## Final focused readback — A2 closed

Reviewer inspected the final `preserveJobFocus(id)` implementation and its calls before asynchronous ready/error updates. It requests recovery only when the focused selected-item Stop control identifies that exact job, or when the focused Stop batch control is about to lose its final pending item. Unrelated focus is left untouched. The existing post-render effect then targets the persistent queue-selection control. Stop controls carry the required job/batch markers.

**A1 and A2 are resolved in source. Final static accessibility-review verdict: approved, with no open material findings in this scope.** Root's actual keyboard/mobile verification remains separate and must not be inferred from this source approval. No further speculative scope is requested.

Final reviewed component SHA-256: `459a8a751b723df1a30ef9476cbeacebdc61b7a73704677d2d189fb91b0e42cd`. CSS remains `4b77b724cf76b1408fbea85a7b7b67690060bfc2bf7371444f6b10aaf47c44f5`.
