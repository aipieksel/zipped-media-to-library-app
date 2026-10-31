# Revision 9 — bounded static accessibility review

Reviewer: `/root/ai_package_audit`. Date: 2026-10-31 UTC. Scope: new Settings navigation/AI settings, AI candidate panel, Convert/Saved navigation, saved color/preview UI and shared dialog integration. Read the GVA handler and accessibility-verifier profile fully. The coordinator explicitly requested **static review only**; browser and assistive-technology execution remain separate gates.

**Verdict: F14 and F15 have been corrected in source on focused readback. Runtime focus and announcement verification remains open.** No full WCAG conformance claim is made. Relevant criteria considered: WCAG 2.2 1.1.1, 1.3.1, 1.4.3, 1.4.10, 2.1.1, 2.4.3, 2.4.7, 4.1.2 and 4.1.3. Contrast/reflow/actual focus and announcement behavior require runtime observation. Findings below retain the initial source evidence followed by their correction disposition.

## F14 — medium — Convert/Saved activation removes the focused control

**Evidence:** `IconViews.tsx` lines 1–5 renders two native pressed-state buttons. Each workspace renders its own instance (`PngSvgWorkspace.tsx` toolbar and `SavedIconsWorkspace.tsx` toolbar). `App.tsx` line 653 switches between two different component types, unmounting the activated button. `changeIconView` at line 339 changes state/preferences but has no handoff to the replacement selected view button. There is no retained shared switch or post-switch focus owner in the inspected source.

**Impact:** a keyboard user activating Saved or Convert loses the focused node when the workspace is replaced. Subsequent traversal can restart outside the control group instead of continuing with the chosen workspace. This affects the requested same-navigation interaction and WCAG 2.4.3 focus order; exact browser behavior is not claimed as observed.

**Smallest correction:** preserve a single switch owner, or hand focus to the corresponding selected replacement view button after a user-initiated switch. Only do this when the initiating focus belongs to the switch; imports, loading saved preferences and other programmatic view changes should not steal focus. Verify Enter/Space activation in both directions and subsequent Tab order.

**Disposition:** corrected in source on focused readback. `App.tsx` lines 339–348 now capture the initiating focus and restore it to the selected replacement `data-icon-view` button on the next frame, provided the user has not moved to another connected control or workspace. `IconViews.tsx` supplies those stable targets. Imports continue through their separate non-focusing view update. No UI change was made by this reviewer; keyboard activation and focus order remain runtime checks for the coordinator.

## F15 — low — successful candidate/color completion lacks a concise live status

**Evidence:** `AiSvgPanel` has a live `stage` span, but its successful completion clears that span while adding the candidate/fidelity details outside a live region. `SavedIconsWorkspace` presents color/native-check completion inside a plain result panel, without a status role. Save success already receives App's toast/status; connection test and errors have appropriate live roles.

**Effect:** a screen-reader user may hear processing start without a clear completion/result announcement, and may need to search manually for the newly rendered candidate or color comparison. This is a scoped WCAG 4.1.3 status-message concern, not a request to move focus or announce the entire preview.

**Smallest improvement:** use a short polite message such as “SVG candidate ready for review” and a saved-color/native-check completion status. Keep focus in place and avoid turning large model summaries or whole canvases into live regions. Confirm actual announcements with assistive technology before claiming a pass.

**Disposition:** corrected in source on focused readback. `AiSvgPanel.tsx` line 87 sets a concise candidate-ready notice rendered in its existing status region. `SavedIconsWorkspace.tsx` line 79 exposes checking/comparison completion through a compact polite status. No complete model summary or large canvas was made live. Actual screen-reader announcements remain unverified.

## Source-supported coverage

- Settings uses a native labeled `dialog`; one shared owner handles Escape/backdrop dismissal and attempts focus restoration. App includes Settings and Images AI in its keyboard-shortcut suppression aggregate.
- Settings tabs expose selected state, tab/panel relationships, roving tab stops and Arrow/Home/End handlers. The new Convert/Saved control uses a group of native pressed-state buttons rather than an incomplete tab pattern.
- Provider/model/reasoning, pairing code/port, task/instructions, zoom/background and color controls have native labels or explicit accessible names. Icon-only close/navigation controls have labels; image previews have source/candidate-specific alt text.
- The later saved-color correction adds a labeled text input for exact six-digit hex entry alongside the native picker, exposes invalid state, gives a visible example and disables Apply until valid. This provides a keyboard text-entry path; actual browser picker/text-entry behavior remains a runtime check.
- Loading/connection/text-test states and errors use status/alert semantics in the relevant surfaces. Controls use actual disabled states while work is unavailable or pending; connection now has Cancel/retry recovery.
- Shared focus-visible styles remain available for buttons, inputs, selects and relevant tabs. New CSS wraps the prompt/pairing/color controls and stacks comparisons at narrow widths. These are implementation observations, not tested visibility or reflow results.
- No new custom password or authentication form was introduced in these reviewed surfaces. Account/Profile implementation is excluded from independent review because this agent implemented it; another reviewer owns it.

## Runtime checks still required

1. Keyboard-only menu → Settings, both tab directions, form traversal, connection cancellation, Escape and focus restoration; then repeat with Settings opened above the Images AI modal.
2. Convert/Saved activation after F14 correction; next Tab should continue from the selected view control, and programmatic imports should not steal focus.
3. Generate/cancel/error/ready/save/discard and color/apply/reset/check updates with a screen reader. Confirm controls remain discoverable and statuses are concise.
4. Narrow viewport and actual browser zoom/reflow, including long model names/errors, source filenames, pairing form, toolbar wrapping and scrollable dialogs. Image zoom is not page-zoom evidence.
5. Actual focus outline visibility, text/UI contrast, and native color-picker keyboard behavior in the supported browser. No contrast measurement, screenshot, screen-reader or cross-browser certification was performed in this static pass.

No browser, package, Git or account action was performed. This artifact records only static evidence and explicitly unverified runtime behavior.

## Final bounded source readback — Settings and dialog scrolling

Read the latest `src/components/AiSettings.tsx` and `src/components/ai.css`, with their shared dialog, Settings tab wrapper and documented CLI compatibility references. No application edits, broad tests, browser, account, Git or task-record mutation were performed by this reviewer. **No new material release blocker was found in this bounded source readback.**

- The Model select now uses the currently available model ID, falling back to its empty placeholder when discovery is absent. Reasoning also displays its placeholder without an available model. Native disabled controls, names, errors and connection/cancel states remain intact; stale saved preferences are not presented as a discovered model.
- The displayed installation command pins `@openai/codex@0.166.0`, matching the isolated CLI/configuration compatibility check documented in `companion/README.md`. This source consistency is not a claim of fresh installation, signed-in authentication or inference verification by this reviewer.
- Open Settings/Images AI dialogs use a flex column with non-shrinking header/tab controls, and a flexible inner panel with `min-height:0` and automatic overflow. The later child rules supersede the earlier panel height limits, including the narrow-width rule. Long Images AI titles wrap within a bounded two-line heading and the close control remains non-shrinking. These source changes support one inner scroll owner without removing the title, close button or Settings tabs from the dialog layout.

### F16 — low advisory — asynchronous connection focus needs a recovery guard

`AiSettings.tsx` line 16 schedules `modelSelect.current?.focus()` after every successful connection. This repairs the happy-path focus loss when Connect is removed, but can move focus from another connected control if the user navigated there during discovery. Discovery may also return a successful companion connection with no models; in that case the target is disabled and cannot receive focus (`AiSettings.tsx` line 28). This is an advisory edge, not a release blocker or an observed browser failure.

The smallest improvement is to preserve another connected active control, otherwise hand focus to the enabled model select or the available Disconnect button. The component ref already becomes null on unmount, preventing a handoff to a closed or replaced Settings panel. Coordinator notified; disposition is source-level advisory at this readback.

### Runtime evidence boundary

The coordinator reports native keyboard arrow navigation and Escape focus restoration, Saved → Convert focus, a 390px Settings dialog with one inner scroll area after correction, and saved blue-color persistence. The coordinator owns the separate e2e evidence report; these were **not independently rerun or witnessed by this source reviewer**. Screen-reader announcements, measured contrast and live-account inference remain explicitly unverified here. Earlier runtime checklist items should be reconciled against that report, not silently treated as passed by this source readback.
