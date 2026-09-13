export type ToolingRole = 'Tooling Technician' | 'Maintenance Planner' | 'Production Supervisor' | 'Toolmaker' | 'Metrology Inspector' | 'Quality Manager';
export interface ToolingActor { id: string; role: ToolingRole }
export interface ToolingEvent { id: string; action: string; actor: string; immutable: true }
export interface ToolingEvidence { id: string; kind: 'wear-reading' | 'repair-record' | 'calibration-certificate' | 'release-record'; value: string; immutable: true }
export interface ToolingState {
  revision: number;
  tool: { id: string; version: number; status: 'service' | 'held' | 'maintenance' | 'repaired' | 'calibrated' | 'released'; cyclesSinceService: number; wearMicrons: number; maximumWearMicrons: number };
  line: { id: string; version: number; status: 'available' | 'held'; activeToolId: string | null };
  spareInsert: { id: string; version: number; status: 'available' | 'reserved' | 'consumed'; quantity: number };
  calibration: { version: number; result: 'due' | 'passed' | 'failed'; measuredMicrons: number | null; sampledAt: string | null };
  maintenanceCase: null | { id: string; status: 'reported' | 'approved' | 'isolated' | 'repaired' | 'calibrated' | 'released'; reporter: string; approver: string | null; toolVersion: number; lineVersion: number; insertVersion: number; calibrationVersion: number };
  evidence: ToolingEvidence[];
  events: ToolingEvent[];
}

export const initialToolingState: ToolingState = {
  revision: 0,
  tool: { id: 'DIE-204', version: 8, status: 'service', cyclesSinceService: 12_000, wearMicrons: 180, maximumWearMicrons: 120 },
  line: { id: 'LINE-4', version: 3, status: 'available', activeToolId: 'DIE-204' },
  spareInsert: { id: 'INSERT-204-A', version: 2, status: 'available', quantity: 1 },
  calibration: { version: 1, result: 'due', measuredMicrons: null, sampledAt: null },
  maintenanceCase: null,
  evidence: [],
  events: [],
};

interface CommandMeta { id: string; expectedRevision: number; actor: ToolingActor }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: ToolingState, command: CommandMeta) {
  assert(state.revision === command.expectedRevision, 'Tooling state changed. Refresh before retrying.');
  assert(!state.events.some((event) => event.id === command.id), 'Tooling command already applied.');
  return structuredClone(state);
}
function currentCase(state: ToolingState) { assert(state.maintenanceCase, 'No tooling maintenance case exists.'); return state.maintenanceCase; }
function assertSnapshots(state: ToolingState) {
  const maintenanceCase = currentCase(state);
  assert(maintenanceCase.toolVersion === state.tool.version, 'Tool changed after the maintenance step.');
  assert(maintenanceCase.lineVersion === state.line.version, 'Production line changed after the maintenance step.');
  assert(maintenanceCase.insertVersion === state.spareInsert.version, 'Reserved insert changed after approval.');
  assert(maintenanceCase.calibrationVersion === state.calibration.version, 'Calibration record changed after the maintenance step.');
}
function synchronizeSnapshots(state: ToolingState) {
  const maintenanceCase = currentCase(state);
  maintenanceCase.toolVersion = state.tool.version;
  maintenanceCase.lineVersion = state.line.version;
  maintenanceCase.insertVersion = state.spareInsert.version;
  maintenanceCase.calibrationVersion = state.calibration.version;
}
function finish(state: ToolingState, command: CommandMeta, action: string) {
  state.revision += 1;
  state.events.push({ id: command.id, action, actor: command.actor.id, immutable: true });
  return state;
}

export function reportToolWear(state: ToolingState, command: CommandMeta & { measuredMicrons: number }) {
  assert(command.actor.role === 'Tooling Technician', 'Only tooling technicians can report tool wear.');
  const next = begin(state, command);
  assert(!next.maintenanceCase && next.tool.status === 'service', 'A service tool without an open case is required.');
  assert(command.measuredMicrons > next.tool.maximumWearMicrons, 'A maintenance case requires wear above the service limit.');
  next.tool.wearMicrons = command.measuredMicrons;
  next.tool.status = 'held';
  next.tool.version += 1;
  next.line.status = 'held';
  next.line.version += 1;
  next.maintenanceCase = { id: `CASE-${next.tool.id}`, status: 'reported', reporter: command.actor.id, approver: null, toolVersion: next.tool.version, lineVersion: next.line.version, insertVersion: next.spareInsert.version, calibrationVersion: next.calibration.version };
  next.evidence.push({ id: `${command.id}-wear`, kind: 'wear-reading', value: `${String(command.measuredMicrons)} microns`, immutable: true });
  return finish(next, command, 'tool-wear-reported');
}

export function approveToolMaintenance(state: ToolingState, command: CommandMeta) {
  assert(command.actor.role === 'Maintenance Planner', 'Only maintenance planners can approve tool maintenance.');
  const next = begin(state, command), maintenanceCase = currentCase(next);
  assert(maintenanceCase.status === 'reported', 'A reported tooling case is required.');
  assert(command.actor.id !== maintenanceCase.reporter, 'Maintenance approval must be independent of reporting.');
  assertSnapshots(next);
  assert(next.spareInsert.status === 'available' && next.spareInsert.quantity === 1, 'An available replacement insert is required.');
  next.spareInsert.status = 'reserved';
  next.spareInsert.version += 1;
  maintenanceCase.status = 'approved';
  maintenanceCase.approver = command.actor.id;
  synchronizeSnapshots(next);
  return finish(next, command, 'tool-maintenance-approved');
}

export function isolateToolFromLine(state: ToolingState, command: CommandMeta) {
  assert(command.actor.role === 'Production Supervisor', 'Only production supervisors can isolate tooling.');
  const next = begin(state, command), maintenanceCase = currentCase(next);
  assert(maintenanceCase.status === 'approved', 'Approved tool maintenance is required.');
  assertSnapshots(next);
  assert(next.line.activeToolId === next.tool.id, 'The affected tool is no longer installed on the line.');
  next.line.activeToolId = null;
  next.line.version += 1;
  next.tool.status = 'maintenance';
  next.tool.version += 1;
  maintenanceCase.status = 'isolated';
  synchronizeSnapshots(next);
  return finish(next, command, 'production-tool-isolated');
}

export function repairProductionTool(state: ToolingState, command: CommandMeta) {
  assert(command.actor.role === 'Toolmaker', 'Only toolmakers can complete tooling repairs.');
  const next = begin(state, command), maintenanceCase = currentCase(next);
  assert(maintenanceCase.status === 'isolated', 'An isolated tool is required for repair.');
  assertSnapshots(next);
  assert(next.spareInsert.status === 'reserved', 'The approved replacement insert is not reserved.');
  next.spareInsert.status = 'consumed';
  next.spareInsert.quantity = 0;
  next.spareInsert.version += 1;
  next.tool.wearMicrons = 30;
  next.tool.cyclesSinceService = 0;
  next.tool.status = 'repaired';
  next.tool.version += 1;
  maintenanceCase.status = 'repaired';
  next.evidence.push({ id: `${command.id}-repair`, kind: 'repair-record', value: `${next.spareInsert.id} installed`, immutable: true });
  synchronizeSnapshots(next);
  return finish(next, command, 'production-tool-repaired');
}

export function calibrateProductionTool(state: ToolingState, command: CommandMeta & { measuredMicrons: number; sampledAt: string }) {
  assert(command.actor.role === 'Metrology Inspector', 'Only metrology inspectors can calibrate production tools.');
  const next = begin(state, command), maintenanceCase = currentCase(next);
  assert(maintenanceCase.status === 'repaired', 'A repaired tool is required for calibration.');
  assertSnapshots(next);
  assert(command.actor.id !== maintenanceCase.reporter, 'Calibration must be independently performed.');
  assert(command.sampledAt === '2026-09-14T08:00:00.000Z', 'A fresh scheduled calibration sample is required.');
  assert(command.measuredMicrons <= 40, 'Calibration result exceeds the release tolerance.');
  next.calibration = { version: next.calibration.version + 1, result: 'passed', measuredMicrons: command.measuredMicrons, sampledAt: command.sampledAt };
  next.tool.status = 'calibrated';
  next.tool.version += 1;
  maintenanceCase.status = 'calibrated';
  next.evidence.push({ id: `${command.id}-calibration`, kind: 'calibration-certificate', value: `${String(command.measuredMicrons)} microns at ${command.sampledAt}`, immutable: true });
  synchronizeSnapshots(next);
  return finish(next, command, 'production-tool-calibrated');
}

export function releaseProductionTool(state: ToolingState, command: CommandMeta) {
  assert(command.actor.role === 'Quality Manager', 'Only quality managers can release production tools.');
  const next = begin(state, command), maintenanceCase = currentCase(next);
  assert(maintenanceCase.status === 'calibrated', 'A calibrated production tool is required.');
  assertSnapshots(next);
  assert(next.calibration.result === 'passed' && next.calibration.measuredMicrons !== null, 'Passing calibration is required.');
  next.tool.status = 'released';
  next.tool.version += 1;
  next.line.activeToolId = next.tool.id;
  next.line.status = 'available';
  next.line.version += 1;
  maintenanceCase.status = 'released';
  next.evidence.push({ id: `${command.id}-release`, kind: 'release-record', value: `${next.tool.id} released to ${next.line.id}`, immutable: true });
  synchronizeSnapshots(next);
  return finish(next, command, 'production-tool-released');
}

export class ToolingRepository {
  static key = 'forgeaxis:tooling-control:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
  read() { const raw = this.storage.getItem(ToolingRepository.key); return raw ? JSON.parse(raw) as ToolingState : structuredClone(initialToolingState); }
  commit(expectedRevision: number, operation: (state: ToolingState) => ToolingState) {
    const state = this.read();
    assert(state.revision === expectedRevision, 'Another session changed tooling control. Refresh before retrying.');
    const next = operation(state);
    this.storage.setItem(ToolingRepository.key, JSON.stringify(next));
    return next;
  }
}
