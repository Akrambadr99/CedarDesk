import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findInspection } from './selectors';
export function createInspectionCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'inspection', title: input.title, input: input.fields }; }
export function applyInspectionCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireInspection(state: Snapshot, id: string) {
    const record = findInspection(state.entities, id);
    if (!record)
        throw new Error('Inspection record was not found.');
    return record;
}
