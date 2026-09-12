/* eslint-disable react-refresh/only-export-components, @typescript-eslint/no-confusing-void-expression */
import { useState } from 'react';
import type { Entity, Snapshot } from '../../workspace/types';
const amount = (item: Entity, key: string) => typeof item.fields[key] === 'number' ? item.fields[key] : 0;
export function qualityDisposition(order: Entity | undefined, entities: Entity[], decision: string) {
    const blockers: string[] = [];
    if (!order)
        return { ready: false, blockers: ['Select a work order.'], accounted: 0 };
    const counts = entities.filter((item) => item.kind === 'count' && item.fields['order'] === order.id);
    const inspections = entities.filter((item) => item.kind === 'inspection' && item.fields['order'] === order.id);
    const accounted = counts.reduce((sum, item) => sum + amount(item, 'good') + amount(item, 'scrap'), 0);
    const target = amount(order, 'target');
    if (decision === 'release') {
        if (accounted !== target)
            blockers.push('All target units must be accounted for.');
        if (inspections.length === 0 || inspections.some((item) => item.status !== 'passed'))
            blockers.push('Every quality inspection must pass.');
    } else if (decision === 'rework') {
        if (!inspections.some((item) => item.status === 'failed'))
            blockers.push('Rework requires a failed quality finding.');
    } else if (!counts.some((item) => amount(item, 'scrap') > 0))
        blockers.push('Scrap disposition requires recorded scrap units.');
    return { ready: blockers.length === 0, blockers, accounted };
}
export function DomainLifecyclePanel({ snapshot }: { snapshot: Snapshot }) {
    const orders = snapshot.entities.filter((item) => item.kind === 'order');
    const [orderId, setOrderId] = useState(orders[0]?.id ?? '');
    const [decision, setDecision] = useState('release');
    const result = qualityDisposition(orders.find((item) => item.id === orderId), snapshot.entities, decision);
    return <section className="sub" aria-label="Quality disposition planner"><h3>Quality disposition planner <span>{result.ready ? 'ready' : 'blocked'}</span></h3><div className="filters"><select aria-label="Disposition order" value={orderId} onChange={(event) => setOrderId(event.target.value)}>{orders.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><select aria-label="Disposition decision" value={decision} onChange={(event) => setDecision(event.target.value)}><option value="release">release</option><option value="rework">rework</option><option value="scrap">scrap</option></select></div><p><b>{result.accounted} units accounted</b><small>{result.ready ? 'The selected disposition has sufficient production evidence.' : result.blockers.join(' ')}</small></p></section>;
}
