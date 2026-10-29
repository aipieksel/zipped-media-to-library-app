# Repository content policy

This repository contains application code and text development documentation.
Imported ZIPs, original HTML, images, image renditions, screenshots, captures,
collection catalogues, resource manifests and source-history bundles must stay
outside Git. Store collection data in private browser/Site storage.

The only media exceptions are the app's root `index.html` entrypoint and small
`public/favicon.svg` icon. Test data is generated in code; real collection
fixtures must not be checked in. Do not put originals or collection data in
`public/`, JavaScript strings, JSON, base64, release assets or CI artifacts.

`.gitignore` excludes common payloads. `npm run check:privacy` scans the Git
index, including force-added files, for disallowed paths and binary/document
payloads. It also runs before tests/builds and in GitHub Actions. CI detects
violations after upload; it cannot prevent a public push or undo an exposure.

Enable the local pre-commit check in every checkout:

```sh
git config core.hooksPath .githooks
```

Run the check before every commit or source transfer. A local hook can be
bypassed, and no automated check proves the absence of embedded private data;
review staged changes as well. Removing a tracked file affects the current tree
only. Old commits, clones and cached copies require separate history/cache
remediation. Repository visibility is independent of the private live Site's
access policy.

## PNG to SVG data boundary

The converter reads local files and processes them in the browser with canvas
and a local worker. Its inputs and generated outputs remain in tab memory;
they are not sent to the cloud collection, Google Drive or IndexedDB. Results
survive switching workspaces in that tab, but are cleared on reload or close.
Downloads save only when requested. Existing Library requests are separate.

Generated SVGs, embedded PNG data and ZIP downloads remain user data and must
not be committed, bundled with the app or attached as CI artifacts. Synthetic
test images are generated from code by `tests/png-fixture-generator.ts`; do
not replace them with real collection files or embedded source payloads.
Keep browser captures and generated test downloads in ignored `.qa/` or
outside the checkout. The repository's existing media exclusions and privacy
checks continue to apply to both workspaces.
