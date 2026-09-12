import{describe,expect,it}from'vitest';import type{Entity}from'../../workspace/types';import{productionReleaseGate}from'./DomainDepthPanel';const r=(id:string,kind:string,status:string,fields:Entity['fields']={}):Entity=>({id,kind,status,title:id,revision:1,fields});describe('productionReleaseGate',()=>{it('combines machine, material, and quality blockers',()=>{const order=r('o','order','queued',{machine:'m',lot:'l',target:10,materialPerUnit:2});expect(productionReleaseGate(order,[r('m','machine','maintenance'),r('l','lot','quarantine',{quantity:5}),r('q','inspection','failed',{order:'o'})]).blockers).toHaveLength(3);});it('derives event progress',()=>{const order=r('o','order','running',{machine:'m',lot:'l',target:10,materialPerUnit:1});expect(productionReleaseGate(order,[r('m','machine','ready'),r('l','lot','released',{quantity:10}),r('c','count','recorded',{order:'o',good:4,scrap:1})]).progress).toBe(50);});});

import { product } from '../../product/definition';
import { execute, fresh } from '../../workspace/engine';
import type { Snapshot, Value } from '../../workspace/types';
function command(state: Snapshot, operation: string, entityId: string, actorId: string, input: Record<string, Value> = {}) {
 return execute(state,{id: operation + String(state.revision),type:'operate',operation,entityId,actorId,input,expectedRevision:state.revision},product,'2026-09-12T12:00:00Z');
}
it('preserves material and counts across downtime and maintenance recovery', () => {
 let state = command(fresh(product),'release','order-1','actor-0');
 state = command(state,'count','order-1','actor-1',{good:10,scrap:0});
 const lot = structuredClone(state.entities.find(item => item.id === 'lot-1'));
 state = command(state,'pause-production','order-1','actor-1',{reason:'Planned tool calibration stop.'});
 const stop = state.entities.find(item => item.kind === 'downtime'); if (!stop) throw new Error('Missing stop');
 state = command(state,'hold','machine-1','actor-0',{reason:'Inspect tooling before restart.'});
 expect(() => command(state,'resume-production',stop.id,'actor-1')).toThrow('maintenance');
 const ticket = state.entities.find(item => item.kind === 'maintenance'); if (!ticket) throw new Error('Missing ticket');
 state = command(state,'repair',ticket.id,'actor-0');
 expect(state.entities.find(item => item.id === 'order-1')?.status).toBe('held');
 state = command(state,'resume-production',stop.id,'actor-1');
 expect(state.entities.find(item => item.id === 'order-1')?.status).toBe('running');
 expect(state.entities.find(item => item.id === 'lot-1')).toEqual(lot);
 expect(state.entities.filter(item => item.kind === 'count')).toHaveLength(1);
 expect(state.entities.find(item => item.id === stop.id)?.fields['resumedAt']).toBe('2026-09-12T12:00:00Z');
});
it('blocks resume through quality failure and rejects unauthorized resume', () => {
 let state = command(fresh(product),'release','order-1','actor-0');
 state = command(state,'pause-production','order-1','actor-1',{reason:'Wait for quality review.'});
 const stop = state.entities.find(item => item.kind === 'downtime'); const inspection = state.entities.find(item => item.kind === 'inspection');
 if (!stop || !inspection) throw new Error('Missing fixture');
 state = command(state,'inspect',inspection.id,'actor-2',{result:'failed'});
 expect(() => command(state,'resume-production',stop.id,'actor-1')).toThrow('quality holds');
 expect(() => command(state,'resume-production',stop.id,'actor-3')).toThrow('role');
});
