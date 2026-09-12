import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findCount } from './selectors';
export function createCountCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'count', title: input.title, input: input.fields }; }
export function applyCountCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireCount(state: Snapshot, id: string) {
    const record = findCount(state.entities, id);
    if (!record)
        throw new Error('Count record was not found.');
    return record;
}
