# Test plan — revision 2

## T1 — R2, R3, R9

Procedure: Node core tests with independent rectangle raster reconstruction and negative comparator cases

Expected: Identical RGBA and coverage, no overlaps, exact differences, no tolerance

Boundary: Pure logic; browser pixels separate

## T2 — R4, R7

Procedure: Embedded byte decode and JSZip readback with duplicate/Unicode/path/reserved names

Expected: Original PNG bytes unchanged and every output unique/safe

Boundary: Node bytes/ZIP tests

## T3 — R5, R8

Procedure: Malformed PNG/bounds/animation/cancel/session budget cases plus converter dependency and network review

Expected: Useful errors, no stale success, bounded allocations, no file requests/storage

Boundary: Unit/component and actual browser checks

## T4 — R3, R4, R9, R10, R11

Procedure: Actual browser native decode→SVG raster comparison for six required PNG classes and deliberate single-pixel mismatch

Expected: Require zero visible differences for each representative standard opaque, fully transparent, partial-alpha, antialiased, true indexed PLTE+tRNS and multicolor PNG in the tested browser. Also require zero differences for at least one partial-alpha original-byte embedded SVG. Separately require a deliberate one-visible-pixel mutation to produce count 1 and no verified badge, and unsupported/profile exceptions to be accurately labeled. Zero tolerance; positive cases cannot pass merely by reporting a mismatch.

Boundary: Record actual browser/version/sRGB; no other engines certified

## T5 — R1, R5, R6, R7

Procedure: Browser library→converter→batch→previews→mode retry→SVG/ZIP downloads→library

Expected: Inputs/results independent, navigation preserved, bytes/names reconcile and controls operate

Boundary: Development browser, existing production collection separate

## T6 — R1, R5, R6, R12

Procedure: Desktop/mobile layout and keyboard/a11y, independent code/privacy review

Expected: No clipped primary actions/overflow, scoped shortcuts, focus/labels/status correct, no unresolved high findings

Boundary: Observed viewports and static review

## T7 — R1, R8, R12

Procedure: npm test; tsc build; npm run build; npm run check:privacy

Expected: Existing suite and final app/Worker package pass, no private payloads staged

Boundary: Source/build, not live rendering

## T8 — R11, R12

Procedure: README/PRIVACY and recorded outcomes checked against actual code/test results

Expected: Accurate limitation, data lifetime and browser coverage claims

Boundary: Documentation and independent review

## T9 — R13, R14

Procedure: Git remote refs/commit checkpoints and Sites source/save/deploy status

Expected: Significant source milestones pushed; main final state and existing private Site published

Boundary: Remote and native deployment evidence
