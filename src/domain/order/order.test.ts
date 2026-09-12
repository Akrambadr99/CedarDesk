import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeOrder } from './analytics';
import { canEditOrder, orderStates } from './policy';
import { countOrderByState, searchOrder, selectOrder } from './selectors';
describe('order domain module', () => { const records = fresh(product).entities; it('selects only order records', () => expect(selectOrder(records).every(record => record.kind === 'order')).toBe(true)); it('searches deterministic fields', () => { const first = selectOrder(records)[0]; expect(first ? searchOrder(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countOrderByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectOrder(records).length)); it('exposes configured states', () => expect(orderStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeOrder(records).total).toBe(selectOrder(records).length)); it('applies edit policy', () => expect(canEditOrder(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'order')!.editors.includes(product.actors[0]!.role))); });
