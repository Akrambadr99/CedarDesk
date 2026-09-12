import type { Product } from '../../workspace/types';
export function lotStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'lot')?.states ?? []; }
export function canEditLot(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'lot')?.editors.includes(role) ?? false; }
export function lotOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'lot' && operation.roles.includes(role) && operation.from.includes(state)); }
