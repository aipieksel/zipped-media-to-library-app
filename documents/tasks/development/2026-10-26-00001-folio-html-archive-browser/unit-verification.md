# Unit verification — revision 3

**Result: 22 focused assertions passed, with zero failures or skipped assertions in the direct runs.** The combined package command also passed both test files. No development or production dependency was added for these checks.

## Commands actually run

Working directory: `/workspace/scratch/d3a22467843d/folio`.

```sh
node --import tsx tests/archive.test.ts
node --import tsx tests/tree.test.ts
node_modules/.bin/tsc -b
npm test
```

| Command | Observed result |
| --- | --- |
| Direct archive test file | Exit 0; 14 passed, 0 failed, 0 skipped |
| Direct tree test file | Exit 0; 8 passed, 0 failed, 0 skipped |
| TypeScript build check | Exit 0; no diagnostics at the completed data-integration check |
| `npm test` | Exit 0; invokes `node --import tsx --test tests/*.test.ts`; this runner output reported 2 passing test files, 0 failed |

The package run emitted an npm environment warning about `http-proxy`; it did not change the successful test result. The 22 assertion total comes from the two direct runs, not from treating the package runner's two file results as 22 separately displayed results. Later root-owned download/UI edits still need the final production typecheck/build gate.

## Archive and image coverage — 14 assertions

Source: [`tests/archive.test.ts`](../../../../tests/archive.test.ts).

| Check | Verified outcome |
| --- | --- |
| Recursive ZIP import | Root HTML, nested archive identity, index labels and retained supporting files reconcile |
| HTML ordering | Index-first natural ordering retains sibling HTML and only collapses an actual index-only folder |
| Identity and encoding | Same-named imports have disjoint IDs; Unicode paths and stored Blob content survive |
| Empty archives | Empty/asset-only archives remain explicit and do not invent HTML |
| Unsafe paths | Traversal, absolute/drive paths and NUL names reject before library normalization |
| Collisions | Duplicate canonical paths reject instead of overwriting |
| Resource budgets | Compressed/expanded/file/count/depth limits reject the affected import |
| Malformed input | Truncated ZIPs and malformed nested ZIPs reject atomically |
| Inflation and CRC | Forged declared sizes and corrupted extracted contents reject |
| Header consistency | Encryption and conflicting local filenames reject |
| Real Library wrapper | Three archives retain exactly 12 HTML pages, 102 supported images and expected CSS/JS/PNG resources |
| Nested image archives | Supported image types are indexed; unsupported files remain resources without becoming image items |
| Direct image originals | One named import contains disjoint canonical item IDs and unchanged original bytes with safe image MIME assignment |
| Invalid image batches | Empty, unsupported, duplicate, unsafe and excessive direct-image selections reject |

The real fixture test uses `../fixtures/nested-real-library-fixture.zip` relative to the repository. It was present for these runs, so this test did not skip. The fixture is test input outside the application source and is not a production asset. A checkout without that fixture explicitly skips only that test.

The image tests verify metadata, MIME assignment and byte preservation. They do not decode images. Some synthetic byte sequences intentionally stand in for image bodies; rendering validity belongs to native image-element/browser checks.

## Shared tree and organization coverage — eight assertions

Source: [`tests/tree.test.ts`](../../../../tests/tree.test.ts).

| Check | Verified outcome |
| --- | --- |
| Outer ZIP search | A matching outer archive includes descendants inside nested ZIPs in the shared order |
| Folder search | A matching ancestor folder includes its nested pages and excludes unrelated siblings |
| Path search | Ancestors and canonical item IDs remain; the original tree is not mutated |
| Empty/no-match search | Blank query preserves the tree; no match produces an empty projection |
| Kind projections | Legacy HTML and images separate correctly; empty user folders remain visible; unrelated empty archive roots disappear |
| Move projection | A moved item appears once in its user folder and retains source archive identity/path without mutating input data |
| Favorites/search consistency | HTML and image favorites plus folder-name search produce the same shared navigation/gallery projection |
| Return to archive | Clearing the folder assignment restores the original nested hierarchy without duplicating IDs |

## Repairs and scope distinction

After adding images to the shared item array, two old HTML-only assertions initially failed because they counted or navigated every item. The tests were updated to project HTML explicitly, preserving their original 12-page and index-order expectations while separately asserting the new image inventory. The production importer was not weakened to satisfy the prior counts. All 14 archive assertions then passed.

Earlier shared-search fixes remain covered by the first four tree assertions. The four new organization assertions exercise kind/favorite/move effects rather than duplicating UI markup.

These Node checks do **not** prove IndexedDB v1-to-v2 behavior in an actual browser, quota handling, visual fidelity, focus behavior, native download delivery, screenshot pixels, or publication. Root is verifying the existing browser database containing 19 HTML items and seven captures, and the reviewer examines transaction abort/reference checks. No mock IndexedDB framework was installed, and no fabricated migration or download pass is claimed here. Build and deployment were pending at this documentation pass.
