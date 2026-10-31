# Revision 10 — appearance implementation handoff

| Field | Value |
| --- | --- |
| Schema | Markdown scoped implementation report, version 1 |
| Run / stage / step | folio-revision-10 / execute-plan / P18 |
| Author | `/root/r10_design_research` |
| Checked at | 2026-10-31T18:23:05.704149+00:00 |
| Current repository HEAD | `018ff95ffec6acea913fc539cc3c0ff43a1de888` |
| Admitted source baseline | `bdf73305ff51dcd59c2b7c9a94a66501845ca560` |
| Status | Scoped implementation and unit/type checks complete; root integration, shared persistence and browser evidence pending |

This implements the delegated appearance portion of the admitted P18 plan. No App routing, persistence adapter, package, Git, account, media, core task-record or deployment changes were made by this agent. The coordinator owns integration and final verification. The artifact adds a tenth file to nine owned code/style/test changes.

## Public API

`src/appearance.ts` exports:

- `AppearancePalette`: exactly `accent`, `background`, `surface`, `text`, `muted`, `border`, each a string.
- `DEFAULT_APPEARANCE`: current Folio colors; no additional presets.
- `APPEARANCE_FIELDS`, `AppearanceField`, `AppearanceValidation`.
- `validateAppearance(value: unknown)`: `{valid: true, palette}` or `{valid: false, errors, message}`. It accepts only six opaque six-digit hex colors, normalizes case/outer whitespace, rejects unknown fields and unsafe values, and checks primary/secondary text contrast against the background and surface.
- `normalizeAppearance(value: unknown)`: a fresh validated palette or safe current defaults.
- `sameAppearance`, `colorContrast`, `appearanceCssVariables`.
- `applyAppearance(palette, target?)` and `resetAppearance(target?)`: allowlisted interface CSS variables on the supplied element or document root. No DOM traversal, artwork mutation, storage or network access.

Pure validation and token generation are usable in the server bundle. The module has no top-level browser access. Reusing its validator avoids a separate server color policy.

`AppearanceSettings` accepts `value: AppearancePalette`, `onSave: (palette) => Promise<void>`, `loading?: boolean`, and `error?: string | null`. Its new stylesheet is imported by the component.

## Form behavior

The compact six-row form combines native color inputs with exact hex fields. Valid drafts preview immediately; invalid color/contrast edits leave the last valid preview visible. Save and Reset call only the supplied persistence owner. Failures leave the draft available and show an error. Discard returns to the saved palette. Leaving the page restores the latest saved value.

Repeated equal server values do not erase a draft. If another server palette arrives while a different draft is dirty, the component displays an explicit conflict and requires discarding/reloading the saved colors before another save. The successful callback updates the local saved baseline only after it resolves.

**Integration:** apply the loaded server palette outside the Appearance route. While the component is mounted it owns preview and cleanup; unrelated polling must not reapply saved values over a local preview. Root owns server revision checks, durable save and two-client persistence evidence.

## Semantic CSS rollout

Five existing stylesheets now use semantic variables for 269 previously literal color declarations: `src/styles.css` and `src/components/{collection,images,png-svg,ai}.css`. Existing per-component literals remain as default fallbacks so Folio's default hues are retained. Existing typography, spacing, dimensions, layout and component structure remain intact.

Core tokens remain `--accent`, `--accent-soft`, `--text`, `--muted`, `--line`, `--canvas`; `--surface` and `--accent-foreground` are added. Custom palettes derive field/surface/hover/selection, text/icon, border/focus, shadow/scrim, toast and semantic status roles. New dropdown code was given the same token contract.

One related state correction makes danger-button hover stay dark red with white text; the generic neutral button hover could otherwise make that label unreadable.

Artwork isolation is explicit. Fixed PNG checker/light/dark planes, AI artwork checkerboards, image transparency grids, gallery preview planes, HTML iframe whites and snapshot image whites remain independent. Fixed preview placeholders keep readable text on their fixed backgrounds. The theme does not alter source files, SVG fills, download bytes or fidelity records.

## Checks actually run

| Check | Command / procedure | Result |
| --- | --- | --- |
| Validator, contrast, token application/reset, artwork-plane invariants | `node --import tsx tests/appearance.test.ts` | Exit 0; 6 tests passed, zero failures; final run at the timestamp above |
| Strict scoped TypeScript | `./node_modules/.bin/tsc --noEmit --target ES2022 --lib ES2022,DOM,DOM.Iterable --module ESNext --moduleResolution Bundler --jsx react-jsx --strict --skipLibCheck --verbatimModuleSyntax src/appearance.ts src/components/AppearanceSettings.tsx` | Exit 0 |
| CSS transformation audit | Compared brace/rule structure and inspected every remaining non-variable literal color | Only intentional fixed preview planes/text remain; normal UI colors have semantic ownership |

The six tests cover defaults and a dark palette, malformed/untrusted color payloads, low-contrast rejection, derived light/dark/vivid accent foregrounds, invalid-update atomicity and reset cleanup, and exact existing artwork background values. They do not claim a browser rendering pass.

Not run by this agent: broad app build, shared server persistence, native browser form/save/reload/reset, responsive screenshots, two-client theme changes, release tests or publication. Those remain in T29/T30 and the coordinator's integration work.

## Handoff hashes

| File | SHA-256 |
| --- | --- |
| `src/appearance.ts` | `46d2d7f69551adc631d00e55be5ba4415ac16bd2daf4e93278bf626ab2756cfc` |
| `src/components/AppearanceSettings.tsx` | `ca8a06b29ac869b65731aa00829a6b1c3bf8a5b46757632f582435acf1c7f2bf` |
| `src/components/appearance.css` | `01eee55db187b11abb42a75c4802f02ca1feaed249d7f13b5de7bed46b207941` |
| `tests/appearance.test.ts` | `ef04553be04513d684163c361ca05ac1843f3e790bea475ddd475af409116a5a` |
| `src/styles.css` | `c1bcb1213fc3ef98f36d904756f9d153d60d7d4c63375659b65b91c052a3dc1d` |
| `src/components/collection.css` | `06ccee6d9dbaf1500d95a77329e04785658e8ee9f2a128bfec5e57f543cf88cc` |
| `src/components/images.css` | `d827e2e08efd2bae465789081e92a9cd09a2adf868b3ca1770e6c57f58a8a4ea` |
| `src/components/png-svg.css` | `ace5c3f439d236bf6b96f9225931ecddeaf23a13adf51947c8d42bb4b7b2a64c` |
| `src/components/ai.css` | `8c0df58935d0c19432bfd2ddf9a9425f65db99d154f43be96ec10403fd127a50` |
