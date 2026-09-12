/* eslint-disable react-refresh/only-export-components, @typescript-eslint/no-confusing-void-expression */
import { useMemo, useState } from 'react';
import type { Entity, Snapshot } from '../../workspace/types';

export function machineReadiness(machine: Entity | undefined, entities: Entity[]) {
    if (machine?.kind !== 'machine') return { ready: false, reasons: ['Choose a machine.'] };
    const activeOrders = entities.filter((item) => item.kind === 'order' && item.fields['machine'] === machine.id && item.status === 'running');
    const maintenance = entities.filter((item) => item.kind === 'maintenance' && item.fields['machine'] === machine.id && item.status === 'open');
    const reasons = [...(machine.status === 'ready' ? [] : [`Machine is ${machine.status}.`]), ...(maintenance.length ? [`${String(maintenance.length)} maintenance window(s) remain open.`] : [])];
    return { ready: reasons.length === 0, activeOrders: activeOrders.length, reasons };
}

export function DomainWorkflowPanel({ snapshot }: { snapshot: Snapshot }) {
    const machines = snapshot.entities.filter((item) => item.kind === 'machine');
    const [machineId, setMachineId] = useState(machines[0]?.id ?? '');
    const [evaluation, setEvaluation] = useState<{ machineId: string; ready: boolean; reasons: string[]; activeOrders?: number }>();
    const current = useMemo(() => machineReadiness(machines.find((item) => item.id === machineId), snapshot.entities), [machineId, machines, snapshot.entities]);
    return <section className="sub" aria-label="Machine readiness review"><h3>Machine readiness review <span>{evaluation?.machineId === machineId ? (evaluation.ready ? 'ready' : 'blocked') : 'not checked'}</span></h3><div className="filters"><select aria-label="Machine to evaluate" value={machineId} onChange={(event) => setMachineId(event.target.value)}>{machines.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.status}</option>)}</select><button onClick={() => setEvaluation({ machineId, ...current })}>Evaluate release</button></div>{evaluation?.machineId !== machineId && <p className="empty">Run the readiness check for this machine.</p>}{evaluation?.machineId === machineId && evaluation.ready && <p><b>Production can be released</b><small>{evaluation.activeOrders ?? 0} active order(s)</small></p>}{evaluation?.machineId === machineId && evaluation.reasons.map((reason) => <p key={reason}><b>Release blocked</b><small>{reason}</small></p>)}</section>;
}
