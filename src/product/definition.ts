import { changeoverKind, changeoverOperations } from '../factory/changeover-workflow';
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Product, Kind, Field, Operation, Entity } from '../workspace/types';
import { entity, find, rows, total, text, number, requireThat, money, overlaps } from '../workspace/values';
const txt = (key: string, label: string): Field => ({ key, label, type: 'text', required: true });
const num = (key: string, label: string, initial = 0, min = 0, max = Number.MAX_SAFE_INTEGER): Field => ({ key, label, type: 'number', required: true, integer: true, initial, min, max });
const date = (key: string, label: string): Field => ({ key, label, type: 'date', required: true, initial: '2026-09-12' });
const ref = (key: string, label: string, reference: string): Field => ({ key, label, type: 'reference', reference, required: true });
const choice = (key: string, label: string, options: string[]): Field => ({ key, label, type: 'select', options, required: true, initial: options[0] ?? '' });
const kind = (key: string, label: string, states: string[], editors: string[], fields: Field[]): Kind => ({ key, label, states, editors, fields, initial: states[0] ?? 'draft' });
const linked = (entities: Entity[], kind: string, key: string, id: string) => rows(entities, kind).filter(item => item.fields[key] === id);
void txt;
void num;
void date;
void ref;
void choice;
void kind;
void linked;
void entity;
void find;
void rows;
void total;
void text;
void number;
void requireThat;
void money;
void overlaps;
const roles = ['Supervisor', 'Operator', 'Quality Engineer', 'Auditor'];
const kinds = [
    kind('lot', 'Material lots', ['released', 'quarantine', 'consumed'], [roles[0]!], [txt('material', 'Material code'), num('quantity', 'Available kilograms', 1000)]),
    kind('machine', 'Production machines', ['ready', 'maintenance', 'changeover'], [roles[0]!], [num('capacity', 'Units per shift', 500, 1), txt('line', 'Production line'), { ...txt('configuredMaterial', 'Configured material'), required: false }]),
    kind('order', 'Work orders', ['queued', 'running', 'held', 'complete'], [roles[0]!], [ref('lot', 'Material lot', 'lot'), ref('machine', 'Machine', 'machine'), num('target', 'Target good units', 100, 1), num('materialPerUnit', 'Kilograms per unit', 2, 1), date('due', 'Due date')]),
    kind('count', 'Production events', ['recorded'], [], [ref('order', 'Work order', 'order'), num('good', 'Good units'), num('scrap', 'Scrapped units'), txt('source', 'Count source')]),
    kind('inspection', 'Quality inspections', ['pending', 'passed', 'failed'], [roles[0]!], [ref('order', 'Work order', 'order'), txt('criterion', 'Acceptance criterion')]),
    kind('maintenance', 'Maintenance tickets', ['open', 'resolved'], [roles[0]!, roles[1]!], [ref('machine', 'Machine', 'machine'), txt('reason', 'Fault details')]),
];
const operations: Operation[] = [
    { key: 'release', label: 'Release production', kind: 'order', from: ['queued'], roles: [roles[0]!], run: ({ state, entity, add }) => {
            const lot = find(state.entities, text(entity.fields, 'lot')), machine = find(state.entities, text(entity.fields, 'machine'));
            requireThat(lot.status === 'released' && machine.status === 'ready', 'Machine and material must both be released.');
            requireThat(!rows(state.entities, 'order').some(row => row.id !== entity.id && row.fields['machine'] === machine.id && ['running', 'held'].includes(row.status)), 'Machine already has active work.');
            requireThat(!machine.fields['configuredMaterial'] || machine.fields['configuredMaterial'] === lot.fields['material'], 'Machine setup does not match the production material.');
            const need = number(entity.fields, 'target') * number(entity.fields, 'materialPerUnit');
            requireThat(number(lot.fields, 'quantity') >= need, 'Insufficient material for this production run.');
            lot.fields['quantity'] = number(lot.fields, 'quantity') - need;
            if (lot.fields['quantity'] === 0)
                lot.status = 'consumed';
            entity.status = 'running';
            add('inspection', 'Final inspection · ' + entity.title, { order: entity.id, criterion: 'Dimensional and finish checks' });
            return 'Released run, consumed staged material and opened quality gate.';
        } },
    { key: 'count', label: 'Record production count', kind: 'order', from: ['running'], roles: [roles[1]!], fields: [num('good', 'Good units', 10), num('scrap', 'Scrapped units')], run: ({ state, entity, input, add }) => { const machine = find(state.entities, text(entity.fields, 'machine')); requireThat(machine.status === 'ready', 'Machine is under maintenance.'); requireThat(number(input, 'good') + number(input, 'scrap') > 0, 'Record at least one produced unit.'); const made = total(linked(state.entities, 'count', 'order', entity.id), 'good') + total(linked(state.entities, 'count', 'order', entity.id), 'scrap'); requireThat(made + number(input, 'good') + number(input, 'scrap') <= number(entity.fields, 'target'), 'Count exceeds material-backed production target.'); add('count', 'Operator production event', { order: entity.id, good: number(input, 'good'), scrap: number(input, 'scrap'), source: 'operator' }); return 'Production count appended; counters recomputed from events.'; } },
    { key: 'inspect', label: 'Record quality decision', kind: 'inspection', from: ['pending'], roles: [roles[2]!], fields: [choice('result', 'Decision', ['passed', 'failed'])], run: ({ state, entity, input }) => { entity.status = text(input, 'result'); const order = find(state.entities, text(entity.fields, 'order')); if (entity.status === 'failed' && order.status === 'running') order.status = 'held'; return 'Quality engineer recorded ' + entity.status + ' inspection.'; } },
    { key: 'complete', label: 'Complete batch', kind: 'order', from: ['running'], roles: [roles[0]!], run: ({ state, entity }) => { const counts = linked(state.entities, 'count', 'order', entity.id); requireThat(total(counts, 'good') + total(counts, 'scrap') === number(entity.fields, 'target'), 'All staged units must be accounted for.'); const gates = linked(state.entities, 'inspection', 'order', entity.id); requireThat(gates.length > 0 && gates.every(row => row.status === 'passed' || rows(state.entities, 'disposition').some(item => item.fields['inspection'] === row.id && item.status === 'released')), 'Every quality inspection must pass.'); entity.status = 'complete'; return 'Batch completed with production and quality evidence.'; } },
    { key: 'hold', label: 'Place machine on maintenance', kind: 'machine', from: ['ready'], roles: [roles[0]!], fields: [txt('reason', 'Maintenance reason')], run: ({ state, entity, input, add }) => {
            entity.status = 'maintenance';
            for (const order of linked(state.entities, 'order', 'machine', entity.id).filter(row => row.status === 'running'))
                order.status = 'held';
            add('maintenance', 'Maintenance · ' + entity.title, { machine: entity.id, reason: text(input, 'reason') });
            return 'Machine removed from production; active work held.';
        } },
    { key: 'repair', label: 'Resolve maintenance', kind: 'maintenance', from: ['open'], roles: [roles[0]!], run: ({ state, entity }) => {
            entity.status = 'resolved';
            const machine = find(state.entities, text(entity.fields, 'machine'));
            if (!linked(state.entities, 'maintenance', 'machine', machine.id).some(row => row.status === 'open')) {
                machine.status = 'ready';
                for (const order of linked(state.entities, 'order', 'machine', machine.id).filter(row => row.status === 'held' && qualityClear(state.entities, row.id) && !linked(state.entities, 'downtime', 'order', row.id).some(stop => stop.status === 'open')))
                    order.status = 'running';
            }
            return 'Maintenance resolved; eligible held work resumed.';
        } },
];
const seed = [entity('lot-1', 'lot', 'Aluminium coil A', 'released', { material: 'AL-6061', quantity: 1000 }), entity('machine-1', 'machine', 'Press 04', 'ready', { capacity: 500, line: 'North assembly' }), entity('order-1', 'order', 'Pump housing batch', 'queued', { lot: 'lot-1', machine: 'machine-1', target: 100, materialPerUnit: 2, due: '2026-10-15' })];
const qualityClear = (entities: Entity[], orderId: string) => linked(entities, 'inspection', 'order', orderId).every(inspection => inspection.status !== 'failed' || rows(entities, 'disposition').some(item => item.fields['inspection'] === inspection.id && item.status === 'released')) && linked(entities, 'disposition', 'order', orderId).every(item => item.status === 'released');
const scrapClear = (entities: Entity[], orderId: string) => linked(entities, 'scrapreview', 'order', orderId).every(item => item.status === 'released');
kinds.push(kind('disposition', 'Quality dispositions', ['planned', 'performed', 'released'], [], [ref('order', 'Affected work order', 'order'), ref('inspection', 'Failed inspection', 'inspection'), txt('plan', 'Rework instructions'), txt('evidence', 'Execution evidence'), { ...ref('verification', 'Verification inspection', 'inspection'), required: false }]));
operations.push(
    { key: 'plan-rework', label: 'Plan quality rework', kind: 'inspection', from: ['failed'], roles: [roles[2]!], fields: [txt('plan', 'Rework instructions')], run: ({ state, entity, input, add }) => {
        const order = find(state.entities, text(entity.fields, 'order'), 'order');
        requireThat(['running', 'held'].includes(order.status), 'Only active production can enter rework.');
        requireThat(!rows(state.entities, 'disposition').some(item => item.fields['inspection'] === entity.id), 'A disposition already exists for this finding.');
        requireThat(text(input, 'plan').trim().length >= 12, 'Provide specific rework instructions.');
        order.status = 'held';
        add('disposition', 'Rework · ' + order.title, { order: order.id, inspection: entity.id, plan: text(input, 'plan').trim(), evidence: 'Awaiting execution' });
        return 'Rework planned; production held and failed inspection preserved.';
    } },
    { key: 'perform-rework', label: 'Record completed rework', kind: 'disposition', from: ['planned'], roles: [roles[1]!], fields: [txt('evidence', 'Execution evidence')], run: ({ state, entity, input, add }) => {
        const order = find(state.entities, text(entity.fields, 'order'), 'order');
        requireThat(order.status === 'held' && find(state.entities, text(order.fields, 'machine'), 'machine').status === 'ready', 'Rework requires held production and a ready machine.');
        requireThat(text(input, 'evidence').trim().length >= 12, 'Describe the completed rework.');
        const inspection = add('inspection', 'Rework verification · ' + order.title, { order: order.id, criterion: text(entity.fields, 'plan') });
        entity.fields['verification'] = inspection.id;
        entity.fields['evidence'] = text(input, 'evidence').trim();
        entity.status = 'performed';
        return 'Rework execution recorded; independent quality verification required.';
    } },
    { key: 'release-rework', label: 'Release verified rework', kind: 'disposition', from: ['performed'], roles: [roles[2]!], run: ({ state, entity }) => {
        const inspection = find(state.entities, text(entity.fields, 'verification'), 'inspection');
        requireThat(inspection.status === 'passed' || rows(state.entities, 'disposition').some(item => item.fields['inspection'] === inspection.id && item.status === 'released'), 'The rework verification inspection must pass.');
        const order = find(state.entities, text(entity.fields, 'order'), 'order');
        requireThat(find(state.entities, text(order.fields, 'machine'), 'machine').status === 'ready', 'Resolve machine maintenance before release.');
        entity.status = 'released';
        if (qualityClear(state.entities, order.id) && !linked(state.entities, 'downtime', 'order', order.id).some(stop => stop.status === 'open')) order.status = 'running';
        return 'Verified disposition released; production resumes only when all quality holds are resolved.';
    } },
    { key: 'retry-rework', label: 'Repeat failed rework', kind: 'disposition', from: ['performed'], roles: [roles[2]!], fields: [txt('plan', 'Revised rework instructions')], run: ({ state, entity, input, add }) => {
        const verification = find(state.entities, text(entity.fields, 'verification'), 'inspection');
        requireThat(verification.status === 'failed', 'Only failed verification can be repeated.');
        requireThat(text(input, 'plan').trim().length >= 12, 'Provide specific rework instructions.');
        requireThat(!rows(state.entities, 'disposition').some(item => item.fields['inspection'] === verification.id), 'Recovery is already planned for this verification.');
        add('disposition', 'Recovery · ' + entity.title, { order: text(entity.fields, 'order'), inspection: verification.id, plan: text(input, 'plan').trim(), evidence: 'Awaiting execution' });
        return 'Recovery plan appended; prior execution and failed verification preserved.';
    } },
);

kinds.push(kind('scrapreview', 'Scrap dispositions', ['pending', 'released'], [], [ref('order', 'Affected work order', 'order'), ref('count', 'Production event', 'count'), num('quantity', 'Scrapped units'), choice('category', 'Scrap category', ['material', 'setup', 'quality']), txt('rationale', 'Disposition rationale'), txt('openedBy', 'Recorded by'), {...txt('releasedBy', 'Released by'), required: false}]));
operations.push(
    {key: 'classify-scrap', label: 'Classify recorded scrap', kind: 'count', from: ['recorded'], roles: [roles[2]!], fields: [choice('category', 'Scrap category', ['material', 'setup', 'quality']), txt('rationale', 'Disposition rationale')], run: ({state, entity, input, actor, add}) => {
        const quantity = number(entity.fields, 'scrap');
        requireThat(quantity > 0, 'Only production events with scrapped units require disposition.');
        requireThat(!rows(state.entities, 'scrapreview').some(item => item.fields['count'] === entity.id), 'This scrap event already has a disposition.');
        requireThat(text(input, 'rationale').trim().length >= 12, 'Provide a specific scrap disposition rationale.');
        const order = find(state.entities, text(entity.fields, 'order'), 'order');
        requireThat(['running', 'held'].includes(order.status), 'Only active production can classify scrap.');
        add('scrapreview', 'Scrap disposition · ' + order.title, {order: order.id, count: entity.id, quantity, category: text(input, 'category'), rationale: text(input, 'rationale').trim(), openedBy: actor.id, releasedBy: ''});
        order.status = 'held';
        return 'Scrap classified; production held for supervisor release.';
    }},
    {key: 'release-scrap', label: 'Release scrap disposition', kind: 'scrapreview', from: ['pending'], roles: [roles[0]!], run: ({state, entity, actor}) => {
        const order = find(state.entities, text(entity.fields, 'order'), 'order');
        requireThat(order.status === 'held', 'The affected production order is no longer held.');
        requireThat(find(state.entities, text(order.fields, 'machine'), 'machine').status === 'ready', 'Resolve machine maintenance before release.');
        requireThat(!linked(state.entities, 'downtime', 'order', order.id).some(item => item.status === 'open'), 'Resolve production downtime before release.');
        requireThat(qualityClear(state.entities, order.id), 'Resolve quality holds before release.');
        entity.status = 'released'; entity.fields['releasedBy'] = actor.id;
        if (scrapClear(state.entities, order.id)) order.status = 'running';
        return 'Scrap disposition released; recorded counts remain immutable and production resumed.';
    }},
);

kinds.push(kind('downtime', 'Production downtime', ['open', 'resumed'], [], [ref('order', 'Work order', 'order'), txt('reason', 'Stop reason'), txt('startedBy', 'Stopped by'), txt('startedAt', 'Stopped at'), {...txt('resumedAt', 'Resumed at'), required: false}]));
operations.push(
    {key: 'pause-production', label: 'Pause production', kind: 'order', from: ['running'], roles: [roles[0]!, roles[1]!], fields: [txt('reason', 'Stop reason')], run: ({state, entity, input, actor, now, add}) => {
        requireThat(text(input, 'reason').trim().length >= 12, 'Describe the production stop in at least 12 characters.');
        requireThat(!linked(state.entities, 'downtime', 'order', entity.id).some(item => item.status === 'open'), 'An open production stop already exists.');
        add('downtime', 'Production stop - ' + entity.title, {order: entity.id, reason: text(input, 'reason').trim(), startedBy: actor.id, startedAt: now});
        entity.status = 'held'; return 'Production paused; consumed material and production events preserved.';
    }},
    {key: 'resume-production', label: 'Resume stopped production', kind: 'downtime', from: ['open'], roles: [roles[0]!, roles[1]!], run: ({state, entity, actor, now}) => {
        requireThat(actor.id === entity.fields['startedBy'] || actor.role === roles[0], 'Only the stopping operator or supervisor can resume production.');
        const order = find(state.entities, text(entity.fields, 'order'), 'order');
        requireThat(order.status === 'held', 'Production is no longer held.');
        requireThat(find(state.entities, text(order.fields, 'machine'), 'machine').status === 'ready', 'Resolve machine maintenance before resuming.');
        requireThat(qualityClear(state.entities, order.id), 'Resolve quality holds before resuming.');
        requireThat(Date.parse(now) >= Date.parse(text(entity.fields, 'startedAt')), 'Resume time cannot precede the production stop.');
        entity.status = 'resumed'; entity.fields['resumedAt'] = now; order.status = 'running';
        return 'Production resumed with original counts and material allocation; downtime retained.';
    }},
);
kinds.push(changeoverKind);
operations.push(...changeoverOperations);
const validate: Product['validate'] = entities => {
    for (const order of rows(entities, 'order')) {
        const counts = linked(entities, 'count', 'order', order.id);
        requireThat(total(counts, 'good') + total(counts, 'scrap') <= number(order.fields, 'target'), 'Production counts exceed target.');
        const reviewed = linked(entities, 'scrapreview', 'order', order.id);
        requireThat(new Set(reviewed.map(item => text(item.fields, 'count'))).size === reviewed.length, 'A production event cannot have duplicate scrap dispositions.');
        for (const item of reviewed) requireThat(number(item.fields, 'quantity') === number(find(entities, text(item.fields, 'count'), 'count').fields, 'scrap'), 'Scrap disposition quantity must match its production event.');
    }
};
const metrics: Product['metrics'] = entities => [{ label: 'Good units', value: String(total(rows(entities, 'count'), 'good')) }, { label: 'Scrap units', value: String(total(rows(entities, 'count'), 'scrap')) }, { label: 'Active orders', value: String(rows(entities, 'order').filter(row => row.status === 'running').length) }];
export const product: Product = { name: 'ForgeAxis', description: 'Material-backed production and quality release', accent: '#9a3412', actors: roles.map((role, index) => ({ id: 'actor-' + String(index), name: ['Maya Hassan', 'Omar Saleh', 'Lina Farouk', 'Nadia Ali'][index] ?? role, role })), kinds, operations, seed, validate, metrics };
