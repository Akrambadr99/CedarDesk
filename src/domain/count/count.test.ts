import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeCount } from './analytics';
import { canEditCount, countStates } from './policy';
import { countCountByState, searchCount, selectCount } from './selectors';
describe('count domain module', () => { const records = fresh(product).entities; it('selects only count records', () => expect(selectCount(records).every(record => record.kind === 'count')).toBe(true)); it('searches deterministic fields', () => { const first = selectCount(records)[0]; expect(first ? searchCount(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countCountByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectCount(records).length)); it('exposes configured states', () => expect(countStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeCount(records).total).toBe(selectCount(records).length)); it('applies edit policy', () => expect(canEditCount(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'count')!.editors.includes(product.actors[0]!.role))); });
