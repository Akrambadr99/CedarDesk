import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findMachine } from './selectors';
export function createMachineCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'machine', title: input.title, input: input.fields }; }
export function applyMachineCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireMachine(state: Snapshot, id: string) {
    const record = findMachine(state.entities, id);
    if (!record)
        throw new Error('Machine record was not found.');
    return record;
}
