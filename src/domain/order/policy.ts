import type { Product } from '../../workspace/types';
export function orderStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'order')?.states ?? []; }
export function canEditOrder(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'order')?.editors.includes(role) ?? false; }
export function orderOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'order' && operation.roles.includes(role) && operation.from.includes(state)); }
