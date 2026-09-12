# ForgeAxis taskability audit

## Workflow audit

Machine readiness combines selection, evaluation ownership, maintenance, and active orders. Production counts combine optimistic events, material-backed targets, and machine state. Quality release combines filtered lots, permissions, and partial eligibility. Maintenance uses fixed schedules, handoff drafts, and retryable feedback. Seed machines, orders, lots, actors, and times make these workflows deterministic; expected task scope is 1–4 files. Static metrics remain a weak source of meaningful tasks, while plant-wide planning or live MES replacement is too broad.

## 30 classified directions

1. **Strong candidate · Medium:** readiness evaluation becomes stale after machine selection changes — explicit evaluation ownership.
2. **Strong candidate · Medium:** combine machine state and open maintenance blockers — deterministic derived policy.
3. **Strong candidate · Medium-Hard:** ignore an older readiness response after a newer evaluation completes — async race.
4. **Strong candidate · Medium-Hard:** optimistic production count rolls back when target changed remotely — event plus revision conflict.
5. **Strong candidate · Medium:** active-order count updates without replacing the chosen machine — derived state.
6. **Strong candidate · Medium-Hard:** partial lot-release plan retains stable reasons after filtering — selection plus policy.
7. **Strong candidate · Medium:** filtered quality selections prune deleted lots only — identity preservation.
8. **Strong candidate · Medium-Hard:** permission change during release leaves the order unchanged and explains why — active control policy.
9. **Strong candidate · Medium-Hard:** material allocation retry retains edited quantities after refresh — conflict recovery.
10. **Strong candidate · Medium:** maintenance recurrence edit preserves completed windows — schedule lifecycle.
11. **Strong candidate · Medium:** shift handoff drafts remain machine scoped — keyed drafts.
12. **Strong candidate · Medium-Hard:** delayed maintenance save remains attached after machine navigation — async ownership.
13. **Strong candidate · Medium:** production event cursor recovers after refreshed counts — cursor plus changing data.
14. **Strong candidate · Medium:** structured lot search and status filters preserve selections — query plus selection.
15. **Strong candidate · Medium-Hard:** cross-tab machine refresh merges without replacing a handoff draft — remote/local boundary.
16. **Strong candidate · Medium:** inspection evidence reports duplicate and digest errors separately.
17. **Strong candidate · Medium:** MES webhook retry remains idempotent after success.
18. **Strong candidate · Medium:** import mapping assigns material errors to stable source rows.
19. **Strong candidate · Medium:** notification snooze transitions with a fixed clock.
20. **Medium:** comment mentions on a maintenance hold.
21. **Medium:** actor-scoped production saved views.
22. **Medium:** activity filters across machine and order events.
23. **Poor hidden-test candidate:** animation timing of machine status changes.
24. **Poor hidden-test candidate:** native print layout for shift summaries.
25. **Too Easy:** rename Ready.
26. **Too Easy:** recolor a quality badge.
27. **Too Easy:** disable one button for one state.
28. **Too Hard:** replace the production planner.
29. **Too Hard:** migrate all manufacturing schemas.
30. **Too Hard:** integrate several live MES systems.

Strong count: **19** Medium/Medium-Hard directions, supported by domain rules and stable browser-visible outcomes.
