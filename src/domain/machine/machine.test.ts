import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeMachine } from './analytics';
import { canEditMachine, machineStates } from './policy';
import { countMachineByState, searchMachine, selectMachine } from './selectors';
describe('machine domain module', () => { const records = fresh(product).entities; it('selects only machine records', () => expect(selectMachine(records).every(record => record.kind === 'machine')).toBe(true)); it('searches deterministic fields', () => { const first = selectMachine(records)[0]; expect(first ? searchMachine(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countMachineByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectMachine(records).length)); it('exposes configured states', () => expect(machineStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeMachine(records).total).toBe(selectMachine(records).length)); it('applies edit policy', () => expect(canEditMachine(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'machine')!.editors.includes(product.actors[0]!.role))); });
