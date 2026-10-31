# Revision10 — independent critique APPROVED

Reviewer: /root/r10_design_research. Full hash-bound critique: artifacts/revision-10-plan-review.md. Reviewed planRevision10 after two substantive corrections.

F-R10-01: private immutable media caching could bypass logout; require private,no-store protected GET/HEAD/conditional responses plus UI URL cleanup. Fixed in P16/T27.

F-R10-02: credential recovery needed a concrete authority and decisive tests; owner step-up/trusted Site-owner reset, expiring single-use hashed tokens, replay and session-revocation checks now explicit. Fixed in P16/T27.

No unresolved material plan finding. Account activation requires the owner's chosen password; teammate hosting access requires a named recipient. These scope only dependent live checks and do not prevent authorized implementation. R29 remains the earlier user-local AI-companion prerequisite.

## Revision11 independent correction review

/root/r10_accounts_architecture and /root/r10_ui_audit reviewed the actual client and independently reproduced the receiver failure with normal functions. Both approve a single call-site correction, default/injected regression, and real native-browser startup check. No authentication, cookie-policy, owner-identity, data-schema or access-policy change is warranted. The production owner session is authenticated; the observed error comes from shared workspace startup. The exact browser failure, successful server login and absent workspace HTTP requests agree with the reproduced defect. Prior arrow-function tests did not exercise this browser receiver contract. Outcome: revised/ready for the bounded P21 repair.
