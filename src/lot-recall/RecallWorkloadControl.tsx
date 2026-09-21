import { useRef, useState } from "react";
import { rankRecallWorkload } from "./recall-portfolio";
import { FactoryExecutionRepository } from "../factory/execution-control";
import {
  browseRecallRecovery,
  getRecallOperationalDrillDown,
  getRecallProductionLink,
  getRecallShipmentRecovery,
  getRecallLineageBalance,
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
  const [executionRepository] = useState(() => new FactoryExecutionRepository(localStorage));
  const [execution, setExecution] = useState(() => executionRepository.read());
  const [authority, setAuthority] =
    useState<RecallAuthority>("Quality Analyst");
  const [message, setMessage] = useState("");
  const [recoveryFilter, setRecoveryFilter] = useState<
    "all" | "outstanding" | "failed"
  >("all");
  const [selectedRecall, setSelectedRecall] = useState("RECALL-SEAL-B88");
  const [shipmentDraft, setShipmentDraft] = useState({ shipment: 'SHIP-77', line: 'LINE-1', customer: 'CUSTOMER-1', units: '20', source: 'DESPATCH-MANIFEST-77' });
  const [returnUnits, setReturnUnits] = useState('10');
  const [selectedShipmentSourceId, setSelectedShipmentSourceId] = useState<string | null>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const workload = rankRecallWorkload(state.recalls, "2026-10-20");
  const recovery = browseRecallRecovery(
    state,
    recoveryFilter === "failed"
      ? { retryState: "unrecovered-failure" }
      : recoveryFilter === "outstanding"
        ? { acknowledgement: "outstanding" }
        : {},
  );
  const drillDown = getRecallOperationalDrillDown(state, selectedRecall);
  const productionLink = getRecallProductionLink(state, execution, selectedRecall);
  const shipmentRecovery = getRecallShipmentRecovery(state, selectedRecall);
  const lineageBalance = getRecallLineageBalance(state, selectedRecall);
  const openLineage = state.lineageInvestigations.filter((item) => item.recallId === selectedRecall && !state.lineageResolutions.some((resolution) => resolution.investigationId === item.id)).at(-1);
  const investigateLineage = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, recallId: selectedRecall, conflictingShipmentReference: null, owner: 'Traceability analyst', evidenceRequired: 'Original dispatch manifest and customer shipment line', openedOn: '2026-10-22' })); setMessage('Untraced recall quantity assigned for source-document investigation.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Lineage investigation failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const resolveLineage = () => { if (!openLineage || !selectedShipmentSourceId) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, investigationId: openLineage.id, shipmentSourceIds: [selectedShipmentSourceId], evidenceReference: shipmentDraft.source, resolvedBy: 'Quality director', resolvedOn: '2026-10-23' })); setMessage('Newly attested shipment line reconciled; residual quantity remains visible.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Lineage resolution failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const attestShipment = () => { try { const id = crypto.randomUUID(); setState(repository.dispatch({ id, expectedRevision: state.revision, authority, recallId: selectedRecall, shipmentReference: shipmentDraft.shipment, lineReference: shipmentDraft.line, customerId: shipmentDraft.customer, lotReference: drillDown?.authoritativeGenealogy ?? '', affectedUnits: Number(shipmentDraft.units), sourceDocument: shipmentDraft.source, recordedBy: 'Traceability analyst' })); setSelectedShipmentSourceId(id); setMessage('Shipment line attested from a named source document; external receipt is not implied.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Shipment source could not be recorded.'); } queueMicrotask(() => feedback.current?.focus()); };
  const recordReturn = () => { if (!selectedShipmentSourceId) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, shipmentSourceId: selectedShipmentSourceId, returnedUnits: Number(returnUnits), custodyReference: `CUSTODY-${shipmentDraft.shipment}`, receivedBy: 'Recovery desk', receivedOn: '2026-10-23' })); setMessage('Local returned-unit custody recorded against the attested shipment line.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Shipment return could not be recorded.'); } queueMicrotask(() => feedback.current?.focus()); };
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
        {recovery.map((item) => <li key={item.recall.recallId}><button aria-pressed={selectedRecall === item.recall.recallId} onClick={() => { setSelectedRecall(item.recall.recallId); }}>{item.recall.recallId}</button> · {item.outstandingAcknowledgements} acknowledgements outstanding · {item.attempts.length} attempts · {item.dispositions.length ? "physical disposition recorded" : "physical disposition outstanding"}</li>)}
      </ol>
      {drillDown && <section aria-label="Recall operational drill-down"><h3>{drillDown.recallId} operational lineage</h3><p>Genealogy {drillDown.authoritativeGenealogy} · owner {drillDown.owner}</p><p aria-label="Production source linkage">Production source {productionLink?.status ?? "missing"} · lot {productionLink?.lotReference ?? "unknown"} · source revision {productionLink?.sourceRevision ?? "unknown"}{productionLink?.orderId ? ` · order ${productionLink.orderId}` : " · production order unavailable"}{productionLink?.status === "verified" ? ` · input ${productionLink.inputLotId} · ${String(productionLink.producedUnits)} units verified by ${productionLink.verifiedBy}` : ""}</p><button onClick={() => { setExecution(executionRepository.read()); }}>Refresh factory genealogy</button><p>Recovery {drillDown.physicalRecovery.recoveredUnits} of {drillDown.physicalRecovery.tracedUnits} units · effectiveness {drillDown.effectivenessDecision?.determination ?? "open"}</p><ol>{drillDown.shipments.map((item) => <li key={`${item.shipmentReference}:${item.customerId}`}>{item.shipmentReference || 'shipment unlinked'} · customer {item.customerId} · lot {item.lotReference} · units {item.unitReferences.join(", ") || "not serialized"} · {item.notificationOutcome} · {item.acknowledged ? "acknowledged" : "awaiting acknowledgement"}</li>)}</ol></section>}
      <section aria-label="Shipment recovery handoff"><h3>Attested shipment recovery</h3><label>Shipment reference<input value={shipmentDraft.shipment} onChange={(event) => { setShipmentDraft({ ...shipmentDraft, shipment: event.target.value }); }} /></label><label>Shipment line<input value={shipmentDraft.line} onChange={(event) => { setShipmentDraft({ ...shipmentDraft, line: event.target.value }); }} /></label><label>Shipment customer<input value={shipmentDraft.customer} onChange={(event) => { setShipmentDraft({ ...shipmentDraft, customer: event.target.value }); }} /></label><label>Affected units<input inputMode="numeric" value={shipmentDraft.units} onChange={(event) => { setShipmentDraft({ ...shipmentDraft, units: event.target.value }); }} /></label><label>Source dispatch document<input value={shipmentDraft.source} onChange={(event) => { setShipmentDraft({ ...shipmentDraft, source: event.target.value }); }} /></label><button disabled={authority !== 'Quality Analyst'} onClick={attestShipment}>Attest shipment line</button><label>Shipment line for recovery<select value={selectedShipmentSourceId ?? ''} onChange={(event) => { setSelectedShipmentSourceId(event.target.value); }}><option value="">Select attested line</option>{shipmentRecovery.map((item) => <option key={item.source.id} value={item.source.id}>{item.source.shipmentReference} · {item.source.lineReference} · {item.source.customerId}</option>)}</select></label><label>Returned units<input inputMode="numeric" value={returnUnits} onChange={(event) => { setReturnUnits(event.target.value); }} /></label><button disabled={authority !== 'Quality Director' || !selectedShipmentSourceId} onClick={recordReturn}>Record local returned-unit custody</button><ol aria-label="Shipment recovery status">{shipmentRecovery.map((item) => <li key={item.source.id}>{item.source.shipmentReference} · {item.source.lineReference} · {item.source.customerId} · {item.returnedUnits}/{item.source.affectedUnits} units returned · {item.status} · source {item.source.sourceDocument} · notice {item.notification?.outcome ?? 'unlinked'}</li>)}</ol></section>
      <section aria-label="Shipment lineage exceptions"><h3>Unresolved shipment lineage</h3><p>{lineageBalance?.affectedUnits ?? 0} affected · {lineageBalance?.tracedShipmentUnits ?? 0} traced through attested shipment lines · {lineageBalance?.untracedUnits ?? 0} untraced</p><p>{openLineage ? `Investigation owner ${openLineage.owner} · evidence required ${openLineage.evidenceRequired}` : 'No active lineage investigation'}</p><button disabled={authority !== 'Quality Director' || !lineageBalance?.untracedUnits || Boolean(openLineage)} onClick={investigateLineage}>Assign untraced lineage investigation</button><button disabled={authority !== 'Quality Director' || !openLineage || !selectedShipmentSourceId} onClick={resolveLineage}>Reconcile newly attested shipment line</button><ol aria-label="Shipment lineage investigation history">{state.lineageInvestigations.filter((item) => item.recallId === selectedRecall).map((item) => { const resolution = state.lineageResolutions.find((entry) => entry.investigationId === item.id); return <li key={item.id}>{item.owner} · opened with {item.affectedUnits - item.tracedAtOpening} untraced · {resolution ? `${String(resolution.resolvedUnits)} resolved; ${String(resolution.residualUnits)} residual` : 'awaiting source-backed resolution'}</li>; })}</ol></section>
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
