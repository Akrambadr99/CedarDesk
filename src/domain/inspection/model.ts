import type { Entity } from '../../workspace/types';
export type InspectionRecord = Entity & {
    kind: 'inspection';
};
export function isInspection(record: Entity): record is InspectionRecord { return record.kind === 'inspection'; }
