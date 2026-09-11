import type { CountEvent, MachineEvent, QualityGate, WorkOrder } from './production'
export const machines=[{id:'MX-04',name:'CNC Cell 04',state:'running',rate:48},{id:'PK-11',name:'Packaging 11',state:'blocked',rate:72},{id:'PR-02',name:'Press 02',state:'maintenance',rate:35}] as const
export const order:WorkOrder={id:'WO-7318',product:'Valve housing V4',target:420,dueAt:'2027-03-15T18:00:00Z',materialAvailable:980,unitMaterial:2,status:'running'}
export const counts:CountEvent[]=[{id:'c1',orderId:'WO-7318',at:'2027-03-15T08:15:00Z',good:164,scrap:7,source:'sensor'},{id:'c2',orderId:'WO-7318',at:'2027-03-15T10:15:00Z',good:142,scrap:4,source:'sensor'}]
export const gates:QualityGate[]=[{id:'q1',orderId:'WO-7318',name:'First article inspection',required:true,result:'passed'},{id:'q2',orderId:'WO-7318',name:'Final dimensional sample',required:true,result:'pending'}]
export const timeline:MachineEvent[]=[{id:'e1',machineId:'MX-04',state:'maintenance',startedAt:'2027-03-15T06:00:00Z',endedAt:'2027-03-15T06:35:00Z',reason:'Planned tooling change'},{id:'e2',machineId:'MX-04',state:'running',startedAt:'2027-03-15T06:35:00Z',endedAt:'2027-03-15T12:00:00Z',reason:'WO-7318 production'}]
