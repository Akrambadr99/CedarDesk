import type { Entity } from '../../workspace/types';
export type MaintenanceRecord = Entity & {
    kind: 'maintenance';
};
export function isMaintenance(record: Entity): record is MaintenanceRecord { return record.kind === 'maintenance'; }
