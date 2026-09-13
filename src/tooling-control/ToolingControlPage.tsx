import { useRef, useState } from 'react';
import { approveToolMaintenance, calibrateProductionTool, isolateToolFromLine, releaseProductionTool, repairProductionTool, reportToolWear, ToolingRepository, type ToolingRole, type ToolingState } from './tooling-control';

const actors: Record<ToolingRole, string> = {
  'Tooling Technician': 'tech-a',
  'Maintenance Planner': 'planner-a',
  'Production Supervisor': 'supervisor-a',
  Toolmaker: 'maker-a',
  'Metrology Inspector': 'metrology-a',
  'Quality Manager': 'quality-a',
};

export function ToolingControlPage() {
  const [repository] = useState(() => new ToolingRepository(localStorage));
  const [state, setState] = useState<ToolingState>(() => repository.read());
  const [role, setRole] = useState<ToolingRole>('Tooling Technician');
  const [message, setMessage] = useState('');
  const feedback = useRef<HTMLParagraphElement>(null);
  const meta = () => ({ id: crypto.randomUUID(), expectedRevision: state.revision, actor: { id: actors[role], role } });
  const run = (operation: (value: ToolingState) => ToolingState, success: string) => {
    try { setState(repository.commit(state.revision, operation)); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Tooling action failed.'); }
    queueMicrotask(() => feedback.current?.focus());
  };
  return <main className="page">
    <header className="page-title"><p>Production engineering</p><h1>Production tooling control</h1><p>Isolate worn tooling, consume approved parts, verify calibration and restore the line.</p></header>
    <section className="workspace-toolbar"><label>Tooling role<select value={role} onChange={(event) => { setRole(event.target.value as ToolingRole); }}>{Object.keys(actors).map((item) => <option key={item}>{item}</option>)}</select></label></section>
    {message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}
    <section className="card">
      <h2>{state.tool.id} · {state.tool.status}</h2>
      <p>Wear {state.tool.wearMicrons}/{state.tool.maximumWearMicrons} microns · cycles {state.tool.cyclesSinceService}</p>
      <p>{state.line.id} · {state.line.status} · installed {state.line.activeToolId ?? 'none'}</p>
      <p>Replacement insert · {state.spareInsert.status} · quantity {state.spareInsert.quantity}</p>
      <p>Calibration · {state.calibration.result} · {state.calibration.measuredMicrons ?? 'not measured'} microns</p>
      <p>Maintenance case · {state.maintenanceCase?.status ?? 'not opened'}</p>
      <button disabled={role !== 'Tooling Technician' || Boolean(state.maintenanceCase)} onClick={() => { run((value) => reportToolWear(value, { ...meta(), measuredMicrons: 180 }), 'Tool wear reported and line held.'); }}>Report tool wear</button>
      <button disabled={role !== 'Maintenance Planner' || state.maintenanceCase?.status !== 'reported'} onClick={() => { run((value) => approveToolMaintenance(value, meta()), 'Tool maintenance approved and insert reserved.'); }}>Approve tool maintenance</button>
      <button disabled={role !== 'Production Supervisor' || state.maintenanceCase?.status !== 'approved'} onClick={() => { run((value) => isolateToolFromLine(value, meta()), 'Production tool isolated from line.'); }}>Isolate production tool</button>
      <button disabled={role !== 'Toolmaker' || state.maintenanceCase?.status !== 'isolated'} onClick={() => { run((value) => repairProductionTool(value, meta()), 'Production tool repaired with reserved insert.'); }}>Repair production tool</button>
      <button disabled={role !== 'Metrology Inspector' || state.maintenanceCase?.status !== 'repaired'} onClick={() => { run((value) => calibrateProductionTool(value, { ...meta(), measuredMicrons: 18, sampledAt: '2026-09-14T08:00:00.000Z' }), 'Production tool calibration passed.'); }}>Calibrate production tool</button>
      <button disabled={role !== 'Quality Manager' || state.maintenanceCase?.status !== 'calibrated'} onClick={() => { run((value) => releaseProductionTool(value, meta()), 'Production tool released and line restored.'); }}>Release production tool</button>
    </section>
    <section className="card" aria-label="Tooling evidence"><h2>Immutable tooling evidence</h2><p>Evidence records: {state.evidence.length}</p>{state.evidence.map((item) => <p key={item.id}>{item.kind} · {item.value}</p>)}</section>
    <section className="card" aria-label="Tooling history"><h2>Tooling history</h2>{state.events.map((event) => <p key={event.id}>{event.action}</p>)}</section>
  </main>;
}
