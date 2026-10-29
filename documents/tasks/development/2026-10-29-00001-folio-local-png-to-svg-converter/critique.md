# Independent critique — revision 1

Reviewer: `/root/fidelity_research`; planner: `/root`.
Verdict: **revised**. Evidence and exact reviewed hashes are in artifacts/plan-review.md.

- **F1 (medium, open):** Strengthen T4 to require actual zero-difference positive results for all six required standard PNG categories in the tested browser, plus an embedded-mode partial-alpha native render check. Keep intentional mismatches and unsupported/profile cases separate. Add R3/R4 to T4's traceability. Current wording can accept universal positive-fixture mismatches as long as they are counted honestly, which does not prove the prioritized exact visual match.
- **F2 (advisory, covered):** Cancellation/removal must suppress stale async results at every decode/generation/render boundary; T3 already owns the check.
- **F3 (advisory, covered):** Keep native canvas dimensions independent from CSS/DPR presentation and explicitly gate existing library drop/keyboard handlers; P2/P3 and T5/T6 already own these checks.

Scope, source privacy, current component ownership, bounds, independent browser evidence, checkpoint pushes and same-private-Site publication are otherwise suitable. No application or test implementation was performed by this reviewer. Final criticized readiness is pending the bounded F1 correction and focused reviewer readback, with no new permission gate.
