import type { Product } from '../../workspace/types';
export function machineStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'machine')?.states ?? []; }
export function canEditMachine(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'machine')?.editors.includes(role) ?? false; }
export function machineOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'machine' && operation.roles.includes(role) && operation.from.includes(state)); }
