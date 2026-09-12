import type { Context, Field, Kind, Operation } from '../workspace/types';
import { find, requireThat, rows, text } from '../workspace/values';

const evidence: Field = { key: 'evidence', label: 'Changeover evidence', type: 'text', required: true };
export const changeoverKind: Kind = {
    key: 'changeover', label: 'Machine changeovers', initial: 'preparing', editors: [],
    states: ['preparing', 'awaiting-quality', 'rejected', 'released', 'cancelled'],
    fields: [
        { key: 'machine', label: 'Changeover machine', type: 'reference', reference: 'machine', required: true },
        { key: 'material', label: 'Target material', type: 'text', required: true },
        { key: 'machineVersion', label: 'Machine version', type: 'number', integer: true, min: 1, required: true },
        evidence,
        { key: 'operator', label: 'Setup operator', type: 'text', required: false },
        { key: 'decision', label: 'Quality decision', type: 'text', required: false },
    ],
};
function machineFor(context: Context) {
    const machine = find(context.state.entities, text(context.entity.fields, 'machine'), 'machine');
    requireThat(machine.status === 'changeover' && machine.revision === context.entity.fields['machineVersion'],
        'Machine state changed. Supervisor recovery is required.');
    return machine;
}
function requireIdle(context: Context, machineId: string) {
    requireThat(!rows(context.state.entities, 'order').some(order => order.fields['machine'] === machineId && ['running', 'held'].includes(order.status)),
        'Complete active production before changing machine setup.');
}
function readEvidence(context: Context) {
    const value = text(context.input, 'evidence').trim();
    requireThat(value.length >= 20, 'Provide at least 20 characters of setup or quality evidence.');
    return value;
}
export const changeoverOperations: Operation[] = [
    {
        key: 'setup-request', label: 'Request machine changeover', kind: 'machine', from: ['ready'], roles: ['Supervisor'],
        fields: [{ key: 'material', label: 'Target material', type: 'text', required: true }, evidence],
        run: context => {
            requireIdle(context, context.entity.id);
            const material = text(context.input, 'material').trim();
            requireThat(rows(context.state.entities, 'lot').some(lot => lot.fields['material'] === material && lot.status === 'released'),
                'Choose a material with a released lot.');
            const note = readEvidence(context);
            context.entity.status = 'changeover';
            context.add('changeover', 'Changeover - ' + context.entity.title, {
                machine: context.entity.id, machineVersion: context.entity.revision + 1,
                material, evidence: note, operator: '', decision: '',
            });
            return 'Machine isolated for changeover; production release is blocked.';
        },
    },
    {
        key: 'setup-complete', label: 'Submit setup evidence', kind: 'changeover', from: ['preparing', 'rejected'], roles: ['Operator'], fields: [evidence],
        run: context => {
            machineFor(context);
            context.entity.fields['evidence'] = readEvidence(context);
            context.entity.fields['operator'] = context.actor.id;
            context.entity.fields['decision'] = '';
            context.entity.status = 'awaiting-quality';
            return 'Operator setup evidence submitted for independent quality release.';
        },
    },
    {
        key: 'setup-reject', label: 'Reject setup evidence', kind: 'changeover', from: ['awaiting-quality'], roles: ['Quality Engineer'], fields: [evidence],
        run: context => {
            machineFor(context);
            const reason = readEvidence(context);
            context.entity.fields['decision'] = reason;
            context.entity.status = 'rejected';
            return 'Setup rejected; machine remains isolated: ' + reason;
        },
    },
    {
        key: 'setup-release', label: 'Release verified setup', kind: 'changeover', from: ['awaiting-quality'], roles: ['Quality Engineer'], fields: [evidence],
        run: context => {
            const machine = machineFor(context);
            requireIdle(context, machine.id);
            requireThat(context.entity.fields['operator'] !== context.actor.id, 'Setup release requires independent quality approval.');
            const note = readEvidence(context);
            machine.fields['configuredMaterial'] = context.entity.fields['material'] ?? '';
            machine.status = 'ready';
            context.entity.fields['decision'] = note;
            context.entity.status = 'released';
            return 'Quality released machine setup for ' + text(context.entity.fields, 'material') + ': ' + note;
        },
    },
    {
        key: 'setup-cancel', label: 'Cancel machine changeover', kind: 'changeover', from: ['preparing'], roles: ['Supervisor'], fields: [evidence],
        run: context => {
            const machine = machineFor(context);
            requireIdle(context, machine.id);
            const reason = readEvidence(context);
            machine.status = 'ready';
            context.entity.status = 'cancelled';
            context.entity.fields['decision'] = reason;
            return 'Changeover cancelled; previous material setup retained: ' + reason;
        },
    },
];
