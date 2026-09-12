import type { Entity } from '../../workspace/types';
export type OrderRecord = Entity & {
    kind: 'order';
};
export function isOrder(record: Entity): record is OrderRecord { return record.kind === 'order'; }
