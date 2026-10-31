# Revision 10 — focused accessibility and UI delta review

Date: 2026-10-31. Independent reviewer: `/root/r10_accounts_architecture`. Scope: sidebar workspace switcher, shared PopoverSelect, routed Settings, Appearance and account forms. Applied AI Development Workflow GVA accessibility-verifier and GVR review-only guidance. No application source, browser, Git or deployment mutation was performed by this reviewer.

**Outcome:** the three actionable source findings below were repaired by the coordinator and rechecked. Source/component verification is complete for this snapshot. Native keyboard, responsive layout, real page zoom and assistive-technology verification remain coordinator evidence; this receipt does not claim a complete GVA browser pass or WCAG conformance.

## Findings and repairs

| ID | Priority | Finding and evidence | Repair / status |
|---|---|---|---|
| A11Y-01 | P2 | Settings occupied `100dvh` with page overflow hidden, while its sidebar lacked vertical scrolling. At narrow widths the logout footer was absolutely positioned; adding an error beneath it could overlap the tab/navigation row. This was a source-derived clipping/overlap risk, not a rendered measurement. | Desktop sidebar now scrolls vertically and retains its navigation height. Mobile uses an in-flow grid for Back, logout/error and navigation, bounded to half the viewport height. **Source corrected; coordinator should verify a short viewport and a narrow logout-error state.** |
| A11Y-02 | P2 | A closed Select trigger always stopped Escape propagation. App's mobile drawer and parent popover also ignored every select-origin event, even when the list was closed. After one Escape closed a list, a second Escape on its trigger could not dismiss the containing panel. | Closed-trigger Escape now passes through; parent handlers still yield for an open list. Executing the actual extracted handlers confirmed closed Escape reaches both panels, open-list Escape remains shielded, and Arrow/Home shortcuts remain shielded. **Handler checks pass; native two-Escape/focus-return sequence remains coordinator verification.** |
| A11Y-03 | P2 | Footer error text used `--danger`, bypassing the existing readable text token. A palette accepted by `validateAppearance` with surface `#111111`, background `#000000`, text `#ffffff`, muted `#bbbbbb` produced only **2.8484:1** for the 11px error text. | Footer now uses `--danger-text`. The actual token generator selects `#bf6c65`, giving **4.9889:1** against that surface. **CSS/token calculation reverified.** |

The coordinator also normalized page section headings to `h2` below Settings' `h1`, with account recovery as an `h3` subsection; matching CSS selectors preserve the existing visual sizes. Profile and Accounts changed only heading markup in this delta, with no authentication behavior change.

## Verified source/component behavior

- Workspace selection is one named button/combobox above Search. Base UI 1.9.0 supplies expanded, listbox, selected-option and disabled semantics. Its installed source was inspected for explicit keyboard/assistive-technology item activation. Options retain text labels; decorative counts/icons are hidden from accessibility names.
- The wrapper commits only explicit item activation; browsing the list or closed-trigger typeahead does not start conversions or switch workspace. App shortcuts yield to the shared control. The portal stays inside a native dialog where applicable; the coordinator separately reported the null-container popup repair working in the browser.
- Settings uses page-navigation links with `aria-current="page"`, a labelled navigation region, a main landmark and a focusable page heading. This is appropriate page navigation; a redundant ARIA tab widget was not added. Section changes explicitly focus the heading.
- Actual components were compiled without CSS and rendered through React's server renderer. All **27 visible inputs** in the exercised states had associated labels or accessible names: Profile 5, Accounts invitation 1, Appearance 12, login 2, registration 4, recovery 3. All rendered buttons had text or explicit names. The Workspace trigger rendered `role="combobox"`, its accessible label and `aria-expanded="false"`. This establishes markup, not screen-reader behavior or native focus movement.
- Auth forms use email/password input types and suitable autocomplete hints. The password-manager username helper is removed from the tab/accessibility order. Statuses and errors use live status/alert roles. Appearance additionally connects field-specific errors with `aria-describedby` and marks invalid values.
- Appearance's six text/color controls preserve visible labels, prevent invalid drafts from changing the theme, retain usable text contrast, and provide explicit Save, Discard and Reset actions. Save status is announced. Actions wrap in narrow layouts.
- Account field pairs collapse to one column at narrow widths, invitation forms stack, and long account identifiers wrap. The auth panel scrolls vertically. The workspace and popup CSS have bounded widths; popup lists scroll within available height. These are source constraints, not proof of every zoom/viewport combination.
- Logout failures now remain visible in the Settings shell across all sections. The previous independent account review rendered that alert in all five sections; this delta corrected its placement risk and themed contrast.

## Browser handoff and limits

The coordinator reported successful functional browser checks for the shared workspace selector, three-file automatic conversion, saved icons and recoloring. Those functional runs do not independently establish the accessibility cases below.

The coordinator should record: keyboard open/Arrow/Enter commit and Escape cancellation; two consecutive Escapes from a nested Sort dropdown; Escape from the mobile Workspace trigger; focus return after closing the drawer/dialog; Tab/Shift+Tab through native-dialog selects; a short Settings viewport around 640×360; a narrow logout-error state around 375px; and real page zoom/reflow. No NVDA, JAWS, VoiceOver, alternate browser, forced-colors or complete accessibility-tree run was performed by this reviewer.

Reference criteria were checked against W3C's primary guidance: [Keyboard, SC 2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html), [Contrast, SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), and [Reflow, SC 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html). Escape conventions and heading-level consistency are interaction/structure checks; this receipt does not misrepresent them as independently sufficient proof of normative conformance.

## Reviewed source identity

| Source | SHA-256 |
|---|---|
| `src/App.tsx` | `083a9699bcb2715093c4c9b79b30cbdf6f7bdb069112ac243c7970089ea03951` |
| `src/components/PopoverSelect.tsx` | `dbe8f921bf99bdba13f9f55eb73bab215917477bbe10cb07914855d22cb39463` |
| `src/components/popover-select.css` | `4a932b4845bcb2a6753c02254d98b934fb1fcbe6ec53c273524c80ca7c49ac2c` |
| `src/components/SettingsPage.tsx` | `ab70ca5a39d5c89198ff5957353a3429f00075ee7c513b48a954ece8a99d3047` |
| `src/components/shell.css` | `d09ec69ab3e7c892ef4958ff3ad98ed536a57833dfaf1f6228a709b27f7a7b48` |
| `src/components/AppearanceSettings.tsx` | `3859a89693b304dba0392542d34828c6e876a07b030bb16b59fcbeba2fc0ee72` |
| `src/components/appearance.css` | `8887dd4ccc1c7689187a4cabff67b7e24c04ff085aea7ba157c7a3dd8ec8d150` |
| `src/components/ProfileSettings.tsx` | `49b3b5ffbc1db550c93dbeec42c0e3212ece7b346e031c0b50b46d24cf74800f` |
| `src/components/AccountsSettings.tsx` | `6fb6a162b17e8dd7c478bc87329ad645ecc0a47bb91789544740e2a181ccf32b` |
| `src/components/account.css` | `e8c37380e90791812abd3a0a236303872ff1eaef8cdc748414cc0bf7652dc097` |
| `src/components/AuthPage.tsx` | `6d87b3237d0b710d9ce418cc0ee4edec20443c2ca2db166509ae07d775237427` |
| `src/appearance.ts` | `46d2d7f69551adc631d00e55be5ba4415ac16bd2daf4e93278bf626ab2756cfc` |

Earlier account-security evidence is preserved in `revision-10-client-security-review.md`; its appended delta receipt rebinds the changed UI hashes. No material source finding remains open within this review's scope, subject to the explicit native-browser follow-up above.
