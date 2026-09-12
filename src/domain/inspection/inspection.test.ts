import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeInspection } from './analytics';
import { canEditInspection, inspectionStates } from './policy';
import { countInspectionByState, searchInspection, selectInspection } from './selectors';
describe('inspection domain module', () => { const records = fresh(product).entities; it('selects only inspection records', () => expect(selectInspection(records).every(record => record.kind === 'inspection')).toBe(true)); it('searches deterministic fields', () => { const first = selectInspection(records)[0]; expect(first ? searchInspection(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countInspectionByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectInspection(records).length)); it('exposes configured states', () => expect(inspectionStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeInspection(records).total).toBe(selectInspection(records).length)); it('applies edit policy', () => expect(canEditInspection(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'inspection')!.editors.includes(product.actors[0]!.role))); });
