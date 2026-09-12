/* eslint-disable @typescript-eslint/no-confusing-void-expression */
import { useMemo, useRef, useState } from 'react';
import { acceptShiftHandoff, consumeMaterial, FactoryExecutionRepository, recordLotGenealogy, releaseMaterial, requestShiftHandoff, reserveMaterial, type FactoryExecutionState, type FactoryRole } from './execution-control';

const actors: Record<FactoryRole, string> = { Supervisor: 'supervisor-a', Operator: 'operator-a', 'Quality Engineer': 'quality-a', Auditor: 'auditor-a' };
export function FactoryExecutionPage() {
    const repository = useMemo(() => new FactoryExecutionRepository(window.localStorage), []);
    const [state, setState] = useState<FactoryExecutionState>(() => repository.read());
    const [role, setRole] = useState<FactoryRole>('Supervisor');
    const [quantity, setQuantity] = useState(200);
    const [note, setNote] = useState('Press four is ready; verify the first-off sample.');
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const feedback = useRef<HTMLParagraphElement>(null);
    const run = (change: (current: FactoryExecutionState) => FactoryExecutionState, message: string) => {
        try { const next = repository.commit(state.revision, change); setState(next); setError(''); setNotice(message); queueMicrotask(() => feedback.current?.focus()); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Factory action failed.'); setNotice(''); queueMicrotask(() => feedback.current?.focus()); }
    };
    const meta = () => ({ id: crypto.randomUUID(), expectedRevision: state.revision, actor: { id: actors[role], role }, at: new Date().toISOString() });
    const allocation = state.allocations.find(item => item.status !== 'consumed') ?? state.allocations.at(-1);
    const handoff = state.handoffs.find(item => item.status === 'awaiting-relief');
    return <main className="page"><header className="page-title"><p>Factory-specific execution</p><h1>Shift, material and genealogy control</h1><p>Coordinate production custody with explicit revision, ownership and evidence rules.</p></header>
      <section className="workspace-toolbar" aria-label="Factory actor"><label>Execution role<select value={role} onChange={event => setRole(event.target.value as FactoryRole)}>{Object.keys(actors).map(item => <option key={item}>{item}</option>)}</select></label><button type="button" onClick={() => { setState(repository.read()); setError(''); setNotice('Factory execution refreshed.'); }}>Refresh execution</button></section>
      {(notice || error) && <p ref={feedback} tabIndex={-1} role={error ? 'alert' : 'status'}>{error || notice}</p>}
      <div className="cards">
        <section className="card" aria-labelledby="shift-control"><h2 id="shift-control">Shift handoff</h2><label>Handoff evidence<textarea value={note} onChange={event => setNote(event.target.value)}/></label><button type="button" disabled={role !== 'Operator' || Boolean(handoff)} onClick={() => run(current => requestShiftHandoff(current, { ...meta(), line: 'North assembly', incoming: 'operator-b', handoffNote: note }), 'Shift handoff requested.')}>Request relief handoff</button><button type="button" disabled={role !== 'Operator' || !handoff} onClick={() => run(current => acceptShiftHandoff(current, { ...meta(), actor: { id: 'operator-b', role: 'Operator' }, handoffId: handoff?.id ?? '', acceptanceNote: note }), 'Shift handoff accepted.')}>Accept assigned handoff</button><p>{handoff ? 'Awaiting operator-b' : 'No pending line handoff'}</p></section>
        <section className="card" aria-labelledby="material-control"><h2 id="material-control">Material allocation</h2><p>Lot balance: {String(state.lotBalances['lot-1'] ?? 0)} kg</p><label>Reservation kilograms<input type="number" min="1" value={quantity} onChange={event => setQuantity(event.target.valueAsNumber)}/></label><button type="button" disabled={role !== 'Supervisor' || Boolean(allocation && allocation.status !== 'consumed')} onClick={() => run(current => reserveMaterial(current, { ...meta(), orderId: 'order-1', lotId: 'lot-1', kilograms: quantity }), 'Material reserved.')}>Reserve for work order</button><button type="button" disabled={role !== 'Operator' || allocation?.status !== 'reserved'} onClick={() => run(current => releaseMaterial(current, { ...meta(), allocationId: allocation?.id ?? '' }), 'Staged material accepted.')}>Accept staged material</button><button type="button" disabled={role !== 'Operator' || allocation?.status !== 'released'} onClick={() => run(current => consumeMaterial(current, { ...meta(), allocationId: allocation?.id ?? '' }), 'Material consumption recorded.')}>Record consumption</button><p>{allocation ? allocation.status + ' · ' + String(allocation.kilograms) + ' kg' : 'No allocation'}</p></section>
        <section className="card" aria-labelledby="genealogy-control"><h2 id="genealogy-control">Lot genealogy</h2><button type="button" disabled={role !== 'Quality Engineer' || allocation?.status !== 'consumed' || state.genealogy.some(item => item.orderId === allocation.orderId)} onClick={() => run(current => recordLotGenealogy(current, { ...meta(), allocationId: allocation?.id ?? '', outputLotId: 'FG-2026-001', quantity: 100 }), 'Lot genealogy verified.')}>Verify output genealogy</button><ol>{state.genealogy.map(item => <li key={item.id}>{item.inputLotId} → {item.outputLotId} · {String(item.quantity)} units</li>)}</ol></section>
      </div>
      <section aria-label="Factory execution history"><h2>Execution history</h2><ol>{state.events.toReversed().map(event => <li key={event.id}>{event.action} · {event.actor} · {event.detail}</li>)}</ol></section>
    </main>;
}
