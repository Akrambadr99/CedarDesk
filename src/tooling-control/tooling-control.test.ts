import { describe, expect, it } from 'vitest';
import { approveToolMaintenance, calibrateProductionTool, initialToolingState, isolateToolFromLine, releaseProductionTool, repairProductionTool, reportToolWear, type ToolingRole, type ToolingState } from './tooling-control';
const meta = (id: string, revision: number, actor: string, role: ToolingRole) => ({ id, expectedRevision: revision, actor: { id: actor, role } });
function repaired() {
  let state = reportToolWear(initialToolingState, { ...meta('report', 0, 'tech-a', 'Tooling Technician'), measuredMicrons: 180 });
  state = approveToolMaintenance(state, meta('approve', 1, 'planner-a', 'Maintenance Planner'));
  state = isolateToolFromLine(state, meta('isolate', 2, 'supervisor-a', 'Production Supervisor'));
  return repairProductionTool(state, meta('repair', 3, 'maker-a', 'Toolmaker'));
}
function calibrated() { return calibrateProductionTool(repaired(), { ...meta('calibrate', 4, 'metrology-a', 'Metrology Inspector'), measuredMicrons: 18, sampledAt: '2026-09-14T08:00:00.000Z' }); }
describe('production tooling control', () => {
  it('releases repaired tooling and preserves dependent inventory evidence', () => {
    const state = releaseProductionTool(calibrated(), meta('release', 5, 'quality-a', 'Quality Manager'));
    expect(state.tool).toMatchObject({ status: 'released', wearMicrons: 30, cyclesSinceService: 0 });
    expect(state.line).toMatchObject({ status: 'available', activeToolId: 'DIE-204' });
    expect(state.spareInsert).toMatchObject({ status: 'consumed', quantity: 0 });
    expect(state.maintenanceCase?.status).toBe('released');
    expect(state.evidence.map((item) => item.kind)).toEqual(['wear-reading', 'repair-record', 'calibration-certificate', 'release-record']);
  });
  it('rejects an out-of-tolerance calibration result', () => {
    expect(() => calibrateProductionTool(repaired(), { ...meta('calibrate', 4, 'metrology-a', 'Metrology Inspector'), measuredMicrons: 48, sampledAt: '2026-09-14T08:00:00.000Z' })).toThrow('release tolerance');
  });
  it('rejects repair after the tool version becomes stale', () => {
    let state = reportToolWear(initialToolingState, { ...meta('report', 0, 'tech-a', 'Tooling Technician'), measuredMicrons: 180 });
    state = approveToolMaintenance(state, meta('approve', 1, 'planner-a', 'Maintenance Planner'));
    state = isolateToolFromLine(state, meta('isolate', 2, 'supervisor-a', 'Production Supervisor'));
    const staleState: ToolingState = structuredClone(state);
    staleState.tool.version += 1;
    expect(() => repairProductionTool(staleState, meta('repair', 3, 'maker-a', 'Toolmaker'))).toThrow('Tool changed');
  });
});
