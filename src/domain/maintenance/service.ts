import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findMaintenance } from './selectors';
export function createMaintenanceCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'maintenance', title: input.title, input: input.fields }; }
export function applyMaintenanceCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireMaintenance(state: Snapshot, id: string) {
    const record = findMaintenance(state.entities, id);
    if (!record)
        throw new Error('Maintenance record was not found.');
    return record;
}
