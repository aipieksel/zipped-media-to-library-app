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
