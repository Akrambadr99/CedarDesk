import type { Entity } from '../../workspace/types';
export type MachineRecord = Entity & {
    kind: 'machine';
};
export function isMachine(record: Entity): record is MachineRecord { return record.kind === 'machine'; }
