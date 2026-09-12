import type { Product } from '../../workspace/types';
export function inspectionStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'inspection')?.states ?? []; }
export function canEditInspection(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'inspection')?.editors.includes(role) ?? false; }
export function inspectionOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'inspection' && operation.roles.includes(role) && operation.from.includes(state)); }
