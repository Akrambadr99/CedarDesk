import type { Entity } from '../../workspace/types';
export type CountRecord = Entity & {
    kind: 'count';
};
export function isCount(record: Entity): record is CountRecord { return record.kind === 'count'; }
