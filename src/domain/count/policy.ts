import type { Product } from '../../workspace/types';
export function countStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'count')?.states ?? []; }
export function canEditCount(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'count')?.editors.includes(role) ?? false; }
export function countOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'count' && operation.roles.includes(role) && operation.from.includes(state)); }
