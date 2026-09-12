import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeMaintenance } from './analytics';
import { canEditMaintenance, maintenanceStates } from './policy';
import { countMaintenanceByState, searchMaintenance, selectMaintenance } from './selectors';
describe('maintenance domain module', () => { const records = fresh(product).entities; it('selects only maintenance records', () => expect(selectMaintenance(records).every(record => record.kind === 'maintenance')).toBe(true)); it('searches deterministic fields', () => { const first = selectMaintenance(records)[0]; expect(first ? searchMaintenance(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countMaintenanceByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectMaintenance(records).length)); it('exposes configured states', () => expect(maintenanceStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeMaintenance(records).total).toBe(selectMaintenance(records).length)); it('applies edit policy', () => expect(canEditMaintenance(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'maintenance')!.editors.includes(product.actors[0]!.role))); });
