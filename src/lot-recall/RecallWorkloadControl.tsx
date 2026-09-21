import { useRef, useState } from "react";
import { rankRecallWorkload } from "./recall-portfolio";
import {
  browseRecallRecovery,
  BrowserRecallAttemptPersistence,
  RecallPortfolioRepository,
  type RecallAuthority,
} from "./recall-control-domain";

export function RecallWorkloadControl() {
  const [repository] = useState(
    () =>
      new RecallPortfolioRepository(
        new BrowserRecallAttemptPersistence(localStorage),
      ),
  );
  const [state, setState] = useState(() => repository.read());
  const [authority, setAuthority] =
    useState<RecallAuthority>("Quality Analyst");
  const [message, setMessage] = useState("");
  const [recoveryFilter, setRecoveryFilter] = useState<
    "all" | "outstanding" | "failed"
  >("all");
  const feedback = useRef<HTMLParagraphElement>(null);
  const workload = rankRecallWorkload(state.recalls, "2026-10-20");
  const recovery = browseRecallRecovery(
    state,
    recoveryFilter === "failed"
      ? { outcome: "failed" }
      : recoveryFilter === "outstanding"
        ? { acknowledgement: "outstanding" }
        : {},
  );
  const reassign = () => {
    try {
      setState(
        repository.dispatch({
          id: crypto.randomUUID(),
          expectedRevision: state.revision,
          authority,
          recallId: "RECALL-SEAL-B88",
          toOwner: "Senior recall cell",
          reviewOn: "2026-10-23",
          asOf: "2026-10-20",
          reason:
            "Low recovery coverage requires dedicated senior recall ownership.",
        }),
      );
      setMessage(
        "Critical recall reassigned and effectiveness review scheduled.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Recall reassignment failed.",
      );
    }
    queueMicrotask(() => feedback.current?.focus());
  };
  const notify = () => {
    try {
      repository.dispatch({
        id: crypto.randomUUID(),
        expectedRevision: state.revision,
        authority,
        recallId: "RECALL-SEAL-B88",
        customerId: "CUSTOMER-1",
        outcome: "acknowledged",
        failureReason: null,
        actor: "Recall desk",
        attemptedOn: "2026-10-22T09:00:00Z",
        retryOf: null,
      });
      const next = repository.read();
      setState(
        repository.dispatch({
          id: crypto.randomUUID(),
          expectedRevision: next.revision,
          authority,
          recallId: "RECALL-SEAL-B88",
          customerId: "CUSTOMER-2",
          outcome: "acknowledged",
          failureReason: null,
          actor: "Recall desk",
          attemptedOn: "2026-10-22T09:05:00Z",
          retryOf: null,
        }),
      );
      setMessage(
        "All affected customers acknowledged the durable recall notification.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Customer notification failed.",
      );
    }
    queueMicrotask(() => feedback.current?.focus());
  };
  const close = () => {
    try {
      setState(
        repository.dispatch({
          id: crypto.randomUUID(),
          expectedRevision: state.revision,
          authority,
          recallId: "RECALL-SEAL-B88",
          customerAcknowledgements: 2,
          repairedUnits: 30,
          scrappedUnits: 15,
          releasedUnits: 0,
          genealogyEvidence: "GEN-SEAL-B88-FINAL",
          determination: "effective",
          decidedBy: "Quality director",
          decidedOn: "2026-10-24",
        }),
      );
      setMessage(
        "Recall effectiveness confirmed after population and disposition reconciliation.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Recall closure failed.",
      );
    }
    queueMicrotask(() => feedback.current?.focus());
  };
  return (
    <section className="card" aria-label="Recall workload">
      <h2>Concurrent recall workload</h2>
      <label>
        Recall portfolio authority
        <select
          value={authority}
          onChange={(event) => {
            setAuthority(event.target.value as RecallAuthority);
          }}
        >
          <option>Quality Analyst</option>
          <option>Quality Director</option>
        </select>
      </label>
      {workload.map((item) => (
        <p key={item.recallId}>
          {item.recallId} · {item.priority} · recovery {item.coveragePercent}% ·{" "}
          {item.unrecoveredUnits} units outstanding · {item.owner}
        </p>
      ))}
      <label>
        Recovery timeline
        <select value={recoveryFilter} onChange={(event) => { setRecoveryFilter(event.target.value as typeof recoveryFilter); }}>
          <option value="all">All recalls</option>
          <option value="outstanding">Missing acknowledgements</option>
          <option value="failed">Failed notification attempts</option>
        </select>
      </label>
      <ol aria-label="Filtered recall recovery">
        {recovery.map((item) => <li key={item.recall.recallId}>{item.recall.recallId} · {item.outstandingAcknowledgements} acknowledgements outstanding · {item.attempts.length} attempts · {item.dispositions.length ? "physical disposition recorded" : "physical disposition outstanding"}</li>)}
      </ol>
      <button
        disabled={
          authority !== "Quality Director" || state.assignmentHistory.length > 0
        }
        onClick={reassign}
      >
        Reassign critical recall
      </button>
      <button
        disabled={
          authority !== "Quality Director" ||
          state.assignmentHistory.length === 0 ||
          state.notificationAttempts.length > 0
        }
        onClick={notify}
      >
        Record customer acknowledgements
      </button>
      <button
        disabled={
          authority !== "Quality Director" ||
          state.acknowledgements.length < 2 ||
          state.closures.length > 0
        }
        onClick={close}
      >
        Confirm final recall effectiveness
      </button>
      {message && (
        <p ref={feedback} tabIndex={-1} role="status">
          {message}
        </p>
      )}
      <ol aria-label="Recall notification history">
        {state.notificationAttempts.map((item) => (
          <li key={item.id}>
            {item.customerId} · {item.outcome} · attempt revision{" "}
            {item.recallRevision}
          </li>
        ))}
      </ol>
      <ol aria-label="Recall acknowledgement history">
        {state.acknowledgements.map((item) => (
          <li key={item.id}>
            {item.customerId} · acknowledged by {item.acknowledgedBy} ·
            notification {item.notificationAttemptId}
          </li>
        ))}
      </ol>
      <ol aria-label="Recall assignment history">
        {state.assignmentHistory.map((item) => (
          <li key={item.id}>
            {item.recallId} · {item.fromOwner} to {item.toOwner} · review{" "}
            {item.reviewOn} · population {item.tracedPopulation}
          </li>
        ))}
      </ol>
      <ol aria-label="Recall closure history">
        {state.closures.map((item) => (
          <li key={item.id}>
            {item.recallId} · {item.determination} · repaired{" "}
            {item.repairedUnits} · scrapped {item.scrappedUnits} · genealogy{" "}
            {item.genealogyEvidence}
          </li>
        ))}
      </ol>
    </section>
  );
}
