# Revision 9 — independent account and profile review

Date: 2026-10-31 UTC. Reviewer: `/root/ai_app_assessment`. Operation: GVR review only, on account/profile code implemented by another owner. This review does not independently review the reviewer's own saved-SVG implementation.

## Outcome

**No material findings in the inspected account/profile boundary and mounting changes.** No source repairs were made during this review. The implementation is consistent with the admitted revision 9 platform-account boundary, read-only profile endpoint, separately authenticated AI connection, and delegated password/security controls.

This is source and focused test evidence. It does not prove actual production account headers, a completed user login/logout, visual layout, or the user's provider account connection. Those remain separate runtime checks.

## Reviewed revision and scope

Repository HEAD at review: `7510a43`; original source baseline `ca95e01`. Read the actual added handler/component/test source and affected existing callers rather than relying only on the implementation summary.

| File | Reviewed SHA-256 |
|---|---|
| `worker/account.mjs` | `da96f7866f0dc3d75848f9b22a70f3cb3278efd8ba4dd665b489fb22ab831945` |
| `worker/index.js` | `ae9d16bd499fccf033ae0460bddcc89cfad44a917d36b8e5a4b5a0316ec66855` |
| `src/components/ProfileSettings.tsx` | `cec025c6b4ec78d27b7c254a76f929d4625336e967c5276e0aaa019e213a35ae` |
| `src/components/Modal.tsx` | `b00aec8c2e5ff28d463f889800cf1cb3dbd3adc39c3a68def3e35e93e3581c10` |
| `src/App.tsx` | `5fb3064230c636e03792210965e729516054c28d81acd0334a983028fef16d2c` |
| `tests/account.test.ts` | `117ef111ca6eb90383f642b60911b3b82f18acb2713c289731256bafc20474d0` |

App review was bounded to global menu/settings state, account Profile mounting, dialog/keyboard suppression, and integration routing; it is not a review of the entire AI/conversion integration. Also inspected the existing preference accessors, Worker packaging entry, and Vite configuration to understand ownership and runtime limits.

Read the GVR command, React frontend profile and shared task contracts. The cloud resource for the code-reviewer handler was unavailable, so the identical named handler was read from the installed workflow mirror provided by root: `/root/.codex/plugins/cache/created-by-me-remote/ai-development-workflow/3.1.0/skills/ai-development-workflow/agents/code-reviewer/agent.md`.

## Boundary review

`worker/account.mjs` reads only the fixed Sites-dispatch identity headers. A valid bounded per-site user id plus email is required; full name alone cannot establish identity. Full names decode only with the explicit percent-encoded UTF-8 marker, with invalid names falling back to email. The endpoint never treats cookie/body/query preferences, generic bearer tokens, collection ingest tokens, or service-access tokens as a user identity.

The handler is correctly scoped to `/api/account` and GET/HEAD. Other methods return 405 and `Allow: GET, HEAD`. HEAD emits no body. Existing collection/resource and platform sign-in/sign-out paths pass through untouched. `worker/index.js` dispatches account requests before the existing collection handler and asset/method fallback. No account logic was inserted into the private R2 collection administrative authorization path.

Successful, unauthenticated and method-error responses are `private, no-store`, include no permissive CORS header or ETag, declare same-origin resource policy, and vary on the identity headers. JSON output and React text rendering do not introduce raw HTML. Fixed same-origin platform sign-in/sign-out links use a fixed root return path; caller-provided query return paths and arbitrary response URLs cannot become redirects.

The trust assumption is explicit and necessary: Sites dispatch must sanitize/supply those headers before invoking the Worker, and the Worker must remain behind that platform boundary. The source does not authenticate arbitrary raw headers on an independently exposed server. This is consistent with the existing private Site architecture and root's Sites documentation findings; it is not independently verified by the synthetic unit test requests.

## Profile and settings review

`ProfileSettings` fetches identity only when the Profile tab is mounted. It uses same-origin credentials, no-store, a 15-second abort timeout, unmount cancellation, response-shape checks, and HTTP/authenticated-state consistency. Loading, unauthenticated, fetch-failure/retry and authenticated UI branches are present. Late fetch results cannot update an unmounted tab.

The display-name preference is stored through the existing browser preference owner and is explicitly labeled local to this browser. It cannot alter Site identity, authentication, or ChatGPT profile. Storage failures remain visible; success appears only after the preference write resolves. No password, provider credential or session token is stored by this component.

Sign-in/sign-out are normal top-level platform links. Password/security actions lead to first-party ChatGPT/OpenAI account help, with new-tab opener isolation. There is no invented local password form or claim that a browser preference controls app access. Account access and the local AI provider connection are described separately.

App mounts AI/Profile inside the existing native dialog owner with labeled tab/tabpanel relationships, roving tab focus, and arrow/Home/End navigation. Settings participates in `anyModal`, so global file-navigation shortcuts do not operate behind it. The existing View and capture settings surface retains its prior role. This source review confirms these controls are wired; actual focus, narrow-layout and rendered behavior still require browser evidence.

## Focused verification

Ran `node --import tsx --test tests/account.test.ts`: exit 0, account test module passed with no failures. Its cases cover valid/missing/partial/malformed identity, encoded-name behavior, name-only rejection, caching/CORS headers, non-identity token/query inputs, read-only methods and HEAD, fixed return paths, and non-interception of existing/platform routes.

Independently opened the component's two help links on 2026-10-31. Both resolve to current first-party pages consistent with the delegated controls:

- [Resetting or Changing Your ChatGPT Password](https://help.openai.com/en/articles/4936828-resetting-or-changing-your-chatgpt-password): account-managed password changes/reset and external identity-provider distinctions.
- [Keeping your OpenAI account secure](https://help.openai.com/en/articles/8304786-keeping-your-openai-account-secure): account security and active-session management.

## Exclusions and remaining evidence

No browser account was probed, no user was signed in/out, no credentials were read, and no API/provider inference was performed. The live Site's sign-in wall and trusted-header enforcement require root's permitted deployment/account checks; a service-access token is not substitute user-account evidence. No screenshot/visual correctness claim is made from this review. Companion isolation, model execution, SVG parsing, saved data, and their broader UI journeys are outside this independent account-review assignment.
