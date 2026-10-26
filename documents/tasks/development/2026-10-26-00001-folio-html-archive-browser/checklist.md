# Complete delivery checklist — revision 3

- [x] R1 — Publish a working ChatGPT Site with multi-ZIP drag-and-drop and file selection.
- [x] R2 — Recursively extract nested ZIPs and preserve each named archive and folder hierarchy.
- [x] R3 — Show only HTML pages in the HTML tab tree; keep a collapsible archive hierarchy and label index pages using their containing folder or archive.
- [x] R4 — Browse pages quickly using the tree and keyboard Up/Down navigation.
- [x] R5 — Render HTML with its linked local CSS, JavaScript, fonts and images.
- [x] R6 — Capture the current page or a batch in the background with progress and honest failure states.
- [x] R7 — Show capture indicators and a screenshot gallery with direct navigation back to each HTML page.
- [x] R8 — Verify the implementation using representative real ZIPs from the banner and CTA collection.
- [x] R9 — Retain imported archives and captures across refresh and permit removal of an imported archive.
- [x] R10 — Isolate imported HTML from the workspace and reject unsafe or excessive archive input with useful errors.
- [x] R11 — Use a compact full-height sidebar without a logo or large drop area; one-line drop hint and one right toolbar, with size/fit/capture options in a settings popover and no reload button.
- [x] R12 — Cycle through every file across collapsed folders using navigation buttons and keyboard, for both HTML and images.
- [x] R13 — Favorite HTML pages and images, with a favorites view and persistent favorite state.
- [x] R14 — Create named workspace folders and move HTML pages or images into them while retaining original linked resources.
- [ ] R15 — Download the selected image or HTML page and its associated resources.
- [x] R16 — Import image ZIPs and individual supported images, and browse them in an Images tab separate from HTML.
- [x] R17 — Upgrade existing browser storage without discarding imported resources, existing HTML identifiers or screenshots.

R15 implementation is present and reviewed. Original PNG delivery passed byte-for-byte; resource ZIP paths/bytes passed an independent harness. Browser ZIP/SVG download completion on the private HTTPS Site remains unverified because the secure sign-in did not complete. No delivery failure on HTTPS has been observed.
