import type { Product } from '../../workspace/types';
export function maintenanceStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'maintenance')?.states ?? []; }
export function canEditMaintenance(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'maintenance')?.editors.includes(role) ?? false; }
export function maintenanceOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'maintenance' && operation.roles.includes(role) && operation.from.includes(state)); }
