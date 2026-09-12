export interface MaterialLot {
    lotId: string;
    material: string;
    quantity: number;
    status: 'released' | 'quarantine' | 'consumed';
}
export interface BomRequirement {
    material: string;
    quantityPerUnit: number;
}
export function materialPlan(lots: MaterialLot[], bom: BomRequirement[], units: number) {
    return bom.map((requirement) => {
        const required = requirement.quantityPerUnit * units;
        const available = lots.filter((lot) => lot.material === requirement.material && lot.status === 'released').reduce((sum, lot) => sum + lot.quantity, 0);
        return { material: requirement.material, required, available, shortage: Math.max(0, required - available) };
    });
}
export function consumeLot(lots: MaterialLot[], lotId: string, quantity: number): MaterialLot[] {
    if (quantity <= 0)
        throw new Error('Material consumption must be positive.');
    const lot = lots.find((candidate) => candidate.lotId === lotId);
    if (!lot)
        throw new Error('Material lot was not found.');
    if (lot.status !== 'released')
        throw new Error('Only a released material lot can be consumed.');
    if (quantity > lot.quantity)
        throw new Error('Consumption exceeds the remaining lot quantity.');
    return lots.map((candidate) => candidate.lotId === lotId ? { ...candidate, quantity: candidate.quantity - quantity, status: candidate.quantity === quantity ? 'consumed' : 'released' } : candidate);
}
