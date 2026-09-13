import { useRef, useState } from 'react';
import {
  approveRelease,
  dispatchReleasedBatch,
  openReleaseDossier,
  recordGenealogy,
  ReleaseDossierRepository,
  verifyReleaseQuality,
  type DossierRole,
  type ReleaseDossierState,
} from './release-dossier';

const actorIds: Record<DossierRole, string> = {
  'Production Supervisor': 'supervisor',
  Operator: 'operator',
  'Quality Engineer': 'quality',
  Shipping: 'shipping',
};

export function ReleaseDossierPage() {
  const [repository] = useState(() => new ReleaseDossierRepository(localStorage));
  const [state, setState] = useState<ReleaseDossierState>(() => repository.read());
  const [role, setRole] = useState<DossierRole>('Production Supervisor');
  const [message, setMessage] = useState('');
  const feedback = useRef<HTMLParagraphElement>(null);

  const command = () => ({
    id: crypto.randomUUID(),
    expectedRevision: state.revision,
    actor: { id: actorIds[role], role },
  });

  const run = (change: (current: ReleaseDossierState) => ReleaseDossierState, success: string) => {
    try {
      setState(repository.commit(state.revision, change));
      setMessage(success);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Release dossier action failed.');
    }
    queueMicrotask(() => feedback.current?.focus());
  };

  return <main className="page">
    <header className="page-title">
      <p>Production release assurance</p>
      <h1>Integrated release dossier</h1>
      <p>Material genealogy, calibrated inspection, work-order completion and shipment custody form one release trail.</p>
    </header>

    <section className="workspace-toolbar">
      <label>
        Release role
        <select value={role} onChange={(event) => { setRole(event.target.value as DossierRole); }}>
          {Object.keys(actorIds).map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <button onClick={() => { setState(repository.read()); }}>Refresh release dossier</button>
    </section>

    {message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}

    <div className="cards">
      <section className="card">
        <h2>Work order {state.order.id}</h2>
        <p>{state.order.status} · {state.order.completedQuantity} of {state.order.requiredQuantity} units</p>
        <p>Gauge {state.gauge.id} · {state.gauge.status} · version {state.gauge.version}</p>
        <p>Dossier {state.dossier?.status ?? 'not opened'}</p>
        <button
          disabled={role !== 'Production Supervisor' || Boolean(state.dossier && !['dispatched', 'cancelled'].includes(state.dossier.status))}
          onClick={() => { run((current) => openReleaseDossier(current, command()), 'Release dossier opened.'); }}
        >Open release dossier</button>
        <button
          disabled={role !== 'Operator' || state.dossier?.status !== 'draft'}
          onClick={() => { run((current) => recordGenealogy(current, {
            ...command(),
            allocations: [
              { lot: 'AL-2409-A', quantity: 80, version: current.inventory.find((item) => item.lot === 'AL-2409-A')?.version ?? -1 },
              { lot: 'AL-2409-B', quantity: 40, version: current.inventory.find((item) => item.lot === 'AL-2409-B')?.version ?? -1 },
            ],
          }), 'Material genealogy recorded.'); }}
        >Record material genealogy</button>
      </section>

      <section className="card">
        <h2>Release and shipment</h2>
        <p>Shipment {state.shipment.status} · {state.shipment.quantity} units</p>
        <p>{state.inventory.map((lot) => lot.lot + ': ' + String(lot.consumed) + ' consumed').join(' · ')}</p>
        <button
          disabled={role !== 'Quality Engineer' || state.dossier?.status !== 'genealogy-recorded'}
          onClick={() => { run((current) => verifyReleaseQuality(current, {
            ...command(),
            sampleSize: 12,
            defects: 0,
            evidence: 'Dimensional sample and surface results meet the released specification.',
          }), 'Release quality verified.'); }}
        >Verify release quality</button>
        <button
          disabled={role !== 'Production Supervisor' || state.dossier?.status !== 'quality-verified'}
          onClick={() => { run((current) => approveRelease(current, command()), 'Production release approved.'); }}
        >Authorize production release</button>
        <button
          disabled={role !== 'Shipping' || state.dossier?.status !== 'approved'}
          onClick={() => { run((current) => dispatchReleasedBatch(current, command()), 'Released batch dispatched.'); }}
        >Dispatch released batch</button>
      </section>
    </div>

    <section aria-label="Release dossier history">
      <h2>Release dossier history</h2>
      <ol>{state.events.toReversed().map((event) => <li key={event.id}>{event.action} · {event.actor} · {event.detail}</li>)}</ol>
    </section>
  </main>;
}
