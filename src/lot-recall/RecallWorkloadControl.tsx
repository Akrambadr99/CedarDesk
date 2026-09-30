import { useRef, useState } from "react";
import { rankRecallWorkload } from "./recall-portfolio";
import { FactoryExecutionRepository } from "../factory/execution-control";
import {
  browseRecallRecovery,
  getRecallOperationalDrillDown,
  getRecallProductionLink,
  getRecallShipmentRecovery,
  getRecallReturnProcessing,
  getRecallEffectivenessEvidenceDate,
  getRecallLineageBalance,
  inspectRecallIntegrity,
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
  const [legacyReference, setLegacyReference] = useState('HISTORICAL-SHIPMENT-ATTESTATION-77');
  const [legacyEvidence, setLegacyEvidence] = useState('Original signed dispatch line and customer receipt inspected.');
  const [returnUnits, setReturnUnits] = useState('10');
  const [residualUnits, setResidualUnits] = useState('10');
  const [residualEvidence, setResidualEvidence] = useState('SCRAP-LOG-SEAL-B88');
  const [residualKind, setResidualKind] = useState<'internal use' | 'scrap' | 'manufacturing variance'>('scrap');
  const [selectedShipmentSourceId, setSelectedShipmentSourceId] = useState<string | null>(null);
  const [selectedReturnId, setSelectedReturnId] = useState('');
  const [processingDraft, setProcessingDraft] = useState({ repaired: '7', scrapped: '3', released: '0', evidence: 'RETURN-INSPECTION-SEAL-B88' });

  const [customerDrafts, setCustomerDrafts] = useState<Record<string, { repaired: string; scrapped: string; released: string; evidence: string; reviewEvidence: string }>>({});
  const customerDraft = customerDrafts[selectedShipmentSourceId ?? ''] ?? { repaired: '10', scrapped: '0', released: '0', evidence: '', reviewEvidence: '' };
  const setCustomerDraft = (draft: typeof customerDraft) => { if (selectedShipmentSourceId) setCustomerDrafts((current) => ({ ...current, [selectedShipmentSourceId]: draft })); };

  const customerReviewEvidence = customerDraft.reviewEvidence;
  const setCustomerReviewEvidence = (value: string) => { setCustomerDraft({ ...customerDraft, reviewEvidence: value }); };
  const [effectivenessDecisionDate, setEffectivenessDecisionDate] = useState('');
  const earliestEffectivenessDate = getRecallEffectivenessEvidenceDate(state, 'RECALL-SEAL-B88') ?? '2026-10-24';

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

  const customerRecovery = shipmentRecovery.find((item) => item.source.id === selectedShipmentSourceId);

  const pendingCustomerDisposition = customerRecovery?.customerDispositions.find((item) => !state.customerDispositionReviews.some((review) => review.dispositionId === item.id));

  const submitCustomerDisposition = () => { if (!customerRecovery) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, shipmentSourceId: customerRecovery.source.id, repairedUnits: Number(customerDraft.repaired), scrappedUnits: Number(customerDraft.scrapped), releasedUnits: Number(customerDraft.released), customerEvidence: customerDraft.evidence, submittedBy: 'Traceability analyst', submittedOn: '2026-10-24' })); setMessage('Customer-site disposition submitted; units remain unresolved until independent approval.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Customer disposition failed.'); } queueMicrotask(() => feedback.current?.focus()); };

  const reviewCustomerDisposition = (decision: 'accepted' | 'returned') => { if (!pendingCustomerDisposition) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, customerDispositionId: pendingCustomerDisposition.id, decision, reviewEvidence: customerReviewEvidence, reviewer: 'Quality director', reviewedOn: '2026-10-25' })); setMessage(decision === 'accepted' ? 'Customer-site evidence accepted; unresolved units reduced without inventing return custody.' : 'Customer-site evidence returned; the original proposal remains historical.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Customer disposition review failed.'); } queueMicrotask(() => feedback.current?.focus()); };

  const returnProcessing = getRecallReturnProcessing(state, selectedRecall);
  const selectedReturn = returnProcessing.find((item) => item.receipt.id === selectedReturnId) ?? returnProcessing.find((item) => item.heldUnits > 0) ?? returnProcessing.at(-1);
  const processReturn = () => { if (!selectedReturn) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, returnId: selectedReturn.receipt.id, repairedUnits: Number(processingDraft.repaired), scrappedUnits: Number(processingDraft.scrapped), releasedUnits: Number(processingDraft.released), inspectionEvidence: processingDraft.evidence, decidedBy: 'Quality director', decidedOn: '2026-10-25' })); setSelectedReturnId(selectedReturn.receipt.id); setMessage('Inspected returned units disposition recorded; remaining custody is reconciled per receipt.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Return disposition failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const lineageBalance = getRecallLineageBalance(state, selectedRecall);
  const integrityFindings = inspectRecallIntegrity(state, execution, selectedRecall);
  const selectedLegacySource = state.shipmentSources.find((item) => item.id === selectedShipmentSourceId && !item.sourceDocument);
  const selectedLegacyReview = state.legacyShipmentReviews.find((item) => item.shipmentSourceId === selectedLegacySource?.id);
  const openLineage = state.lineageInvestigations.filter((item) => item.recallId === selectedRecall && !state.lineageResolutions.some((resolution) => resolution.investigationId === item.id && (!resolution.reviewRequired || state.lineageReviews.some((review) => review.resolutionId === resolution.id && review.decision === 'accepted')))).at(-1);
  const pendingResidual = state.residualDispositions.filter((item) => item.recallId === selectedRecall && !state.residualReviews.some((review) => review.dispositionId === item.id)).at(-1);
  const pendingLineage = state.lineageResolutions.filter((item) => item.investigationId === openLineage?.id && item.reviewRequired && !state.lineageReviews.some((review) => review.resolutionId === item.id)).at(-1);
  const investigateLineage = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, recallId: selectedRecall, conflictingShipmentReference: null, owner: 'Traceability analyst', evidenceRequired: 'Original dispatch manifest and customer shipment line', openedOn: '2026-10-22' })); setMessage('Untraced recall quantity assigned for source-document investigation.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Lineage investigation failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const resolveLineage = () => { if (!openLineage || !selectedShipmentSourceId) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, investigationId: openLineage.id, shipmentSourceIds: [selectedShipmentSourceId], evidenceReference: shipmentDraft.source, resolvedBy: 'Traceability analyst', resolvedOn: '2026-10-23' })); setMessage('Investigated shipment linkage submitted for independent review; quantity remains unresolved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Lineage proposal failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const reviewLineage = (decision: 'accepted' | 'rejected') => { if (!pendingLineage) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, resolutionId: pendingLineage.id, decision, reviewer: 'Quality director', reviewEvidence: shipmentDraft.source, reviewedOn: '2026-10-24' })); setMessage(decision === 'accepted' ? 'Reviewed shipment lineage accepted into recall coverage.' : 'Investigated linkage rejected; affected quantity remains unresolved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Lineage review failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const proposeResidual = () => { if (!openLineage) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, investigationId: openLineage.id, kind: residualKind, units: Number(residualUnits), evidenceReference: residualEvidence, investigator: 'Traceability analyst', proposedOn: '2026-10-23' })); setMessage('Non-shipped quantity proposed; it remains unresolved until independent review.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Residual disposition failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const reviewResidual = (decision: 'accepted' | 'rejected') => { if (!pendingResidual) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, dispositionId: pendingResidual.id, decision, reviewer: 'Quality director', reviewEvidence: residualEvidence, reviewedOn: '2026-10-24' })); setMessage(decision === 'accepted' ? 'Reviewed non-shipped quantity reconciled; remaining residual is visible.' : 'Disposition rejected; affected quantity remains unresolved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Residual review failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const attestShipment = () => { try { const id = crypto.randomUUID(); setState(repository.dispatch({ id, expectedRevision: state.revision, authority, recallId: selectedRecall, shipmentReference: shipmentDraft.shipment, lineReference: shipmentDraft.line, customerId: shipmentDraft.customer, lotReference: drillDown?.authoritativeGenealogy ?? '', affectedUnits: Number(shipmentDraft.units), sourceDocument: shipmentDraft.source, recordedBy: 'Traceability analyst' })); setSelectedShipmentSourceId(id); setMessage('Shipment line attested from a named source document; external receipt is not implied.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Shipment source could not be recorded.'); } queueMicrotask(() => feedback.current?.focus()); };
  const importLegacy = () => { try { const id = crypto.randomUUID(); setState(repository.dispatch({ id, expectedRevision: state.revision, authority, recallId: selectedRecall, shipmentReference: shipmentDraft.shipment, lineReference: shipmentDraft.line, customerId: shipmentDraft.customer, lotReference: drillDown?.authoritativeGenealogy ?? '', affectedUnits: Number(shipmentDraft.units), attestationReference: legacyReference, recordedBy: 'Traceability analyst' })); setSelectedShipmentSourceId(id); setMessage('Historical shipment attestation recorded as unverified; affected quantity remains unresolved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Legacy shipment intake failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const reviewLegacy = (decision: 'accepted' | 'rejected') => { if (!selectedLegacySource) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, shipmentSourceId: selectedLegacySource.id, decision, supportingEvidence: legacyEvidence, reviewer: 'Quality director', reviewedOn: '2026-10-24' })); setMessage(decision === 'accepted' ? 'Legacy shipment linkage accepted after independent evidence review.' : 'Legacy shipment linkage rejected; affected quantity remains unresolved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Legacy shipment review failed.'); } queueMicrotask(() => feedback.current?.focus()); };
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
          decidedOn: effectivenessDecisionDate || earliestEffectivenessDate,
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
      <section aria-label="Recall evidence integrity">
        <h3>Evidence integrity</h3>
        <p>{integrityFindings.length === 0 ? 'No integrity conflicts found in current recall evidence.' : `${String(integrityFindings.length)} integrity finding${integrityFindings.length === 1 ? '' : 's'} require source review.`}</p>
        <ol>{integrityFindings.map((finding, index) => <li key={`${finding.code}:${finding.recordId}:${String(index)}`}><strong>{finding.code.replaceAll('_', ' ')}</strong> · {finding.detail} {finding.remediation}</li>)}</ol>
      </section>
      <section aria-label="Shipment recovery handoff"><h3>Attested shipment recovery</h3><label>Shipment reference<input value={shipmentDraft.shipment} onChange={(event) => { setShipmentDraft({ ...shipmentDraft, shipment: event.target.value }); }} /></label><label>Shipment line<input value={shipmentDraft.line} onChange={(event) => { setShipmentDraft({ ...shipmentDraft, line: event.target.value }); }} /></label><label>Shipment customer<input value={shipmentDraft.customer} onChange={(event) => { setShipmentDraft({ ...shipmentDraft, customer: event.target.value }); }} /></label><label>Affected units<input inputMode="numeric" value={shipmentDraft.units} onChange={(event) => { setShipmentDraft({ ...shipmentDraft, units: event.target.value }); }} /></label><label>Source dispatch document<input value={shipmentDraft.source} onChange={(event) => { setShipmentDraft({ ...shipmentDraft, source: event.target.value }); }} /></label><button disabled={authority !== 'Quality Analyst'} onClick={attestShipment}>Attest shipment line</button><label>Shipment line for recovery<select value={selectedShipmentSourceId ?? ''} onChange={(event) => { setSelectedShipmentSourceId(event.target.value); }}><option value="">Select attested line</option>{shipmentRecovery.map((item) => <option key={item.source.id} value={item.source.id}>{item.source.shipmentReference} · {item.source.lineReference} · {item.source.customerId}</option>)}</select></label><label>Returned units<input inputMode="numeric" value={returnUnits} onChange={(event) => { setReturnUnits(event.target.value); }} /></label><button disabled={authority !== 'Quality Director' || !selectedShipmentSourceId} onClick={recordReturn}>Record local returned-unit custody</button><ol aria-label="Shipment recovery status">{shipmentRecovery.map((item) => <li key={item.source.id}>{item.source.shipmentReference} · {item.source.lineReference} · {item.source.customerId} · {item.returnedUnits}/{item.source.affectedUnits} units returned · {item.status} · source {item.source.sourceDocument} · notice {item.notification?.outcome ?? 'unlinked'}</li>)}</ol></section>

      <section aria-label="Customer-site recall disposition"><h3>Recovery at the customer</h3>{customerRecovery ? <><p aria-label="Customer-site unit reconciliation">{customerRecovery.source.shipmentReference} · {customerRecovery.source.customerId} · affected {customerRecovery.source.affectedUnits} = returned {customerRecovery.returnedUnits} + controlled at customer {customerRecovery.controlledAtCustomer} + unresolved {customerRecovery.outstandingUnits}</p><label>Customer repaired units<input inputMode="numeric" value={customerDraft.repaired} onChange={(event) => { setCustomerDraft({ ...customerDraft, repaired: event.target.value }); }} /></label><label>Customer scrapped units<input inputMode="numeric" value={customerDraft.scrapped} onChange={(event) => { setCustomerDraft({ ...customerDraft, scrapped: event.target.value }); }} /></label><label>Customer released units<input inputMode="numeric" value={customerDraft.released} onChange={(event) => { setCustomerDraft({ ...customerDraft, released: event.target.value }); }} /></label><label>Customer inspection evidence<input value={customerDraft.evidence} onChange={(event) => { setCustomerDraft({ ...customerDraft, evidence: event.target.value }); }} /></label><button disabled={authority !== 'Quality Analyst' || Boolean(pendingCustomerDisposition) || customerRecovery.outstandingUnits <= 0} onClick={submitCustomerDisposition}>Submit customer-site disposition</button>{pendingCustomerDisposition && <><p>Independent review pending; proposed units are not yet controlled.</p><label>Customer disposition review evidence<input value={customerReviewEvidence} onChange={(event) => { setCustomerReviewEvidence(event.target.value); }} /></label><button disabled={authority !== 'Quality Director'} onClick={() => { reviewCustomerDisposition('accepted'); }}>Accept customer-site disposition</button><button disabled={authority !== 'Quality Director'} onClick={() => { reviewCustomerDisposition('returned'); }}>Return customer-site disposition</button></>}<details><summary>Customer-site disposition history ({customerRecovery.customerDispositions.length})</summary><ol aria-label="Customer-site disposition history">{customerRecovery.customerDispositions.map((item) => <li key={item.id}>{item.customerEvidence} · repaired {item.repairedUnits} · scrapped {item.scrappedUnits} · released {item.releasedUnits} · {state.customerDispositionReviews.find((review) => review.dispositionId === item.id)?.decision ?? 'awaiting review'} · source revision {item.sourceRevision}</li>)}</ol></details><button onClick={() => { setState(repository.read()); setMessage('Recall sources refreshed; customer disposition draft is preserved.'); }}>Refresh customer recovery</button></> : <p>Select an attested shipment line to resolve remaining customer units.</p>}</section>

      <section aria-label="Returned-unit disposition"><h3>Physical return disposition</h3><p>Received units remain held until an independent quality decision records inspected repair, scrap, or release.</p>{returnProcessing.length === 0 ? <p>No physical return receipts have been recorded.</p> : <><label>Return receipt for disposition<select value={selectedReturn?.receipt.id ?? ''} onChange={(event) => { setSelectedReturnId(event.target.value); }}>{returnProcessing.map((item) => <option key={item.receipt.id} value={item.receipt.id}>{item.receipt.custodyReference} · {item.source?.shipmentReference} · {item.heldUnits} held</option>)}</select></label><p aria-label="Returned-unit balance">Received {selectedReturn?.receipt.returnedUnits ?? 0} = repaired {selectedReturn?.repairedUnits ?? 0} + scrapped {selectedReturn?.scrappedUnits ?? 0} + released {selectedReturn?.releasedUnits ?? 0} + held {selectedReturn?.heldUnits ?? 0}</p><fieldset><legend>Inspected disposition quantities</legend><label>Repaired returned units<input inputMode="numeric" value={processingDraft.repaired} onChange={(event) => { setProcessingDraft({ ...processingDraft, repaired: event.target.value }); }} /></label><label>Scrapped returned units<input inputMode="numeric" value={processingDraft.scrapped} onChange={(event) => { setProcessingDraft({ ...processingDraft, scrapped: event.target.value }); }} /></label><label>Released returned units<input inputMode="numeric" value={processingDraft.released} onChange={(event) => { setProcessingDraft({ ...processingDraft, released: event.target.value }); }} /></label><label>Returned-unit inspection evidence<input value={processingDraft.evidence} onChange={(event) => { setProcessingDraft({ ...processingDraft, evidence: event.target.value }); }} /></label></fieldset><button disabled={authority !== 'Quality Director' || !selectedReturn?.heldUnits} onClick={processReturn}>Authorize inspected return disposition</button><details><summary>Returned-unit disposition history ({selectedReturn?.history.length ?? 0})</summary><ol aria-label="Returned-unit disposition history">{selectedReturn?.history.map((item) => <li key={item.id}>Repaired {item.repairedUnits} · scrapped {item.scrappedUnits} · released {item.releasedUnits} · {item.inspectionEvidence} · {item.decidedBy} · source revision {item.sourceRevision}</li>)}</ol></details></>}</section>
      <section aria-label="Legacy shipment attestation review"><h3>Historical shipment attestations</h3><p>Imported attestations remain outside recall coverage until independent evidence review.</p><label>Historical attestation reference<input value={legacyReference} onChange={(event) => { setLegacyReference(event.target.value); }} /></label><button disabled={authority !== "Quality Analyst"} onClick={importLegacy}>Import legacy shipment attestation</button><p>Selected attestation {selectedLegacySource?.legacyAttestation ?? "none"} · {selectedLegacyReview?.decision ?? "awaiting review"}</p><label>Legacy review evidence<input value={legacyEvidence} onChange={(event) => { setLegacyEvidence(event.target.value); }} /></label><button disabled={authority !== "Quality Director" || !selectedLegacySource || Boolean(selectedLegacyReview)} onClick={() => { reviewLegacy("accepted"); }}>Accept legacy shipment evidence</button><button disabled={authority !== "Quality Director" || !selectedLegacySource || Boolean(selectedLegacyReview)} onClick={() => { reviewLegacy("rejected"); }}>Reject legacy shipment evidence</button><ol aria-label="Legacy shipment review history">{state.shipmentSources.filter((item) => item.recallId === selectedRecall && !item.sourceDocument).map((item) => { const review = state.legacyShipmentReviews.find((entry) => entry.shipmentSourceId === item.id); return <li key={item.id}>{item.shipmentReference} · {item.lineReference} · {item.customerId} · {item.affectedUnits} units · {item.legacyAttestation ?? "historical reference unavailable"} · {review?.decision ?? "unverified"} · {review?.supportingEvidence ?? "supporting evidence required"}</li>; })}</ol></section>
      <section aria-label="Non-shipped recall disposition"><h3>Investigated non-shipped quantity</h3><p aria-label="Recall quantity reconciliation">Affected {lineageBalance?.affectedUnits ?? 0} = reviewed shipment {lineageBalance?.tracedShipmentUnits ?? 0} + verified non-shipped {lineageBalance?.nonShippedUnits ?? 0} + unresolved {lineageBalance?.untracedUnits ?? 0}</p><label>Disposition type<select value={residualKind} onChange={(event) => { setResidualKind(event.target.value as typeof residualKind); }}><option>scrap</option><option>internal use</option><option>manufacturing variance</option></select></label><label>Non-shipped units<input inputMode="numeric" value={residualUnits} onChange={(event) => { setResidualUnits(event.target.value); }} /></label><label>Disposition source evidence<input value={residualEvidence} onChange={(event) => { setResidualEvidence(event.target.value); }} /></label><button disabled={authority !== 'Quality Analyst' || !openLineage || !lineageBalance?.untracedUnits || Boolean(pendingResidual)} onClick={proposeResidual}>Propose non-shipped disposition</button><button disabled={authority !== 'Quality Director' || !pendingResidual} onClick={() => { reviewResidual('accepted'); }}>Accept non-shipped evidence</button><button disabled={authority !== 'Quality Director' || !pendingResidual} onClick={() => { reviewResidual('rejected'); }}>Reject non-shipped evidence</button><ol aria-label="Non-shipped disposition history">{state.residualDispositions.filter((item) => item.recallId === selectedRecall).map((item) => <li key={item.id}>{item.kind} · {item.units} units · {item.evidenceReference} · {state.residualReviews.find((review) => review.dispositionId === item.id)?.decision ?? 'pending review'}</li>)}</ol></section>
      <section aria-label="Shipment lineage exceptions"><h3>Unresolved shipment lineage</h3><p>{lineageBalance?.affectedUnits ?? 0} affected · {lineageBalance?.tracedShipmentUnits ?? 0} traced through reviewed shipment lines · {lineageBalance?.untracedUnits ?? 0} untraced</p><p>{openLineage ? `Investigation owner ${openLineage.owner} · evidence required ${openLineage.evidenceRequired}` : 'No active lineage investigation'}</p><button disabled={authority !== 'Quality Director' || !lineageBalance?.untracedUnits || Boolean(openLineage)} onClick={investigateLineage}>Assign untraced lineage investigation</button><button disabled={authority !== 'Quality Analyst' || !openLineage || !selectedShipmentSourceId || Boolean(pendingLineage)} onClick={resolveLineage}>Submit investigated shipment linkage</button><button disabled={authority !== 'Quality Director' || !pendingLineage} onClick={() => { reviewLineage('accepted'); }}>Accept investigated linkage</button><button disabled={authority !== 'Quality Director' || !pendingLineage} onClick={() => { reviewLineage('rejected'); }}>Reject investigated linkage</button><ol aria-label="Shipment lineage investigation history">{state.lineageInvestigations.filter((item) => item.recallId === selectedRecall).map((item) => { const resolution = state.lineageResolutions.filter((entry) => entry.investigationId === item.id).at(-1); const review = state.lineageReviews.find((entry) => entry.resolutionId === resolution?.id); return <li key={item.id}>{item.owner} · opened with {item.affectedUnits - item.tracedAtOpening} untraced · {resolution ? `${String(resolution.resolvedUnits)} proposed; ${String(resolution.residualUnits)} residual · ${review?.decision ?? 'awaiting independent review'}` : 'awaiting source-backed proposal'}</li>; })}</ol></section>
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
      <label>Final recall decision date<input type="date" value={effectivenessDecisionDate || earliestEffectivenessDate} onChange={(event) => { setEffectivenessDecisionDate(event.target.value); }} /></label>
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
