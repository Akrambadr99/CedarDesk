import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findLot } from './selectors';
export function createLotCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'lot', title: input.title, input: input.fields }; }
export function applyLotCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireLot(state: Snapshot, id: string) {
    const record = findLot(state.entities, id);
    if (!record)
        throw new Error('Lot record was not found.');
    return record;
}
