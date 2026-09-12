# ForgeAxis task calibration report

ForgeAxis is calibrated around machine availability, production evidence, quality gates, and maintenance ownership. The new readiness review combines the selected machine, open maintenance, active orders, and an explicit evaluation snapshot.

| Workflow group | Why it is medium | React/state concepts | Hidden-test determinism | Likely future patch |
|---|---|---|---|---|
| Machine readiness | Machine changes can stale a prior evaluation | derived state, result ownership, permissions | High | 1–3 existing files |
| Production and counts | Totals, order target, machine state, and partial events interact | reducers, optimistic rollback, aggregation | High | 2–4 files |
| Quality and lots | Bulk decisions need per-lot eligibility and visible reasons | selection preservation, partial success | High | 2–4 files |
| Maintenance and shifts | Scheduling and handoff state cross time and actor boundaries | recurrence, drafts, async feedback | High with fixed clock | 2–4 files |

## Calibration

- **Medium majority:** stale machine readiness checks; active-order counts; production count rollback; filtered lot selection; partial quality release; maintenance recurrence edits; shift handoff drafts; material allocation conflicts; machine-specific saved views; inspection evidence uploads; permission change during release; out-of-order count feedback; cursor paging of production events; structured lot search; comment mentions on holds; webhook retries for MES delivery; import mapping for materials; activity filters; notification snooze; undo/redo schedule edits.
- **Reject as Too Easy:** recolor a machine badge; change a button label; show one static tooltip; require one text field.
- **Reject as Too Hard:** replace the planning engine; add a plant-wide schema migration; integrate several live MES services; redesign every production screen together.

The 20 Medium directions above are independently observable and normally fit 1–4 existing files. Fixed machines, orders, lots, timestamps, and actors support reliable hidden tests.
