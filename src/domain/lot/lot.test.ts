import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeLot } from './analytics';
import { canEditLot, lotStates } from './policy';
import { countLotByState, searchLot, selectLot } from './selectors';
describe('lot domain module', () => { const records = fresh(product).entities; it('selects only lot records', () => expect(selectLot(records).every(record => record.kind === 'lot')).toBe(true)); it('searches deterministic fields', () => { const first = selectLot(records)[0]; expect(first ? searchLot(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countLotByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectLot(records).length)); it('exposes configured states', () => expect(lotStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeLot(records).total).toBe(selectLot(records).length)); it('applies edit policy', () => expect(canEditLot(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'lot')!.editors.includes(product.actors[0]!.role))); });
