import { useMemo, useState } from 'react'
import { counts as seedCounts, gates as seedGates, machines, order, timeline } from './factory/fixtures'
import { MachineStateStrip } from './factory/MachineStateStrip'
import { materialPlan } from './factory/materials'
import { completeOrder, oee, productionTotals, type CountEvent, type FactoryRole, type QualityGate } from './factory/production'
import { ProductionTimeline } from './factory/ProductionTimeline'
import { QualityGatePanel } from './factory/QualityGatePanel'
import { summarizeShift } from './factory/shifts'

type Console = 'line' | 'timeline' | 'quality' | 'materials' | 'handoff'
const shift = { id: 'SHIFT-B', startsAt: '2027-03-15T06:00:00Z', endsAt: '2027-03-15T14:00:00Z', crew: 'Cell team B' }

function App() {
  const [activeConsole, setActiveConsole] = useState<Console>('line')
  const [counts, setCounts] = useState<CountEvent[]>(seedCounts)
  const [gates, setGates] = useState<QualityGate[]>(seedGates)
  const [role, setRole] = useState<FactoryRole>('Supervisor')
  const [message, setMessage] = useState('')
  const totals = useMemo(() => productionTotals(counts, order.id), [counts])
  const shiftSummary = useMemo(() => summarizeShift(shift, counts, timeline), [counts])
  const materials = materialPlan([{ lotId: 'AL-991', material: 'AL-6061', quantity: 980, status: 'released' }], [{ material: 'AL-6061', quantityPerUnit: 2 }], order.target)

  function completeBatch() {
    try { completeOrder(order, gates, counts); setMessage('Batch completion recorded; genealogy and quality packet sealed.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Batch completion failed.') }
  }

  return <div className="plant-app"><header className="plant-header"><div className="plant-brand"><span>FA</span><div><strong>ForgeAxis</strong><small>PLANT 02 / NORTH CELL</small></div></div><div className="shift-clock"><span>SHIFT B</span><strong>14:20:08</strong><small>local plant time</small></div><label>Active station role<select aria-label="Factory role" value={role} onChange={(event) => { setRole(event.target.value as FactoryRole) }}><option>Operator</option><option>Supervisor</option><option>Quality Engineer</option><option>Maintenance Engineer</option></select></label></header>
    <nav className="console-tabs" aria-label="Factory consoles">{(['line', 'timeline', 'quality', 'materials', 'handoff'] as Console[]).map((console) => <button key={console} aria-current={activeConsole === console ? 'page' : undefined} onClick={() => { setActiveConsole(console) }}>{console}</button>)}</nav>
    <main>{message && <p className="plant-message" role="status">{message}</p>}
      {activeConsole === 'line' && <><Heading kicker="LIVE OPERATIONS" title="Line control" detail="Production totals are reconstructed from sensor and operator counter events." /><MachineStateStrip machines={machines} /><section className="work-order"><header><div><span>RUNNING WORK ORDER</span><h2>{order.id} · {order.product}</h2></div><b>Due 18:00</b></header><div className="order-body"><div className="radial"><strong>{totals.good}</strong><span>of {order.target} good</span></div><div className="order-stats"><div><span>Scrap</span><strong>{totals.scrap}</strong></div><div><span>Shift OEE</span><strong>{oee(.92, .88, .97)}%</strong></div><div><span>Material staged</span><strong>{order.materialAvailable} kg</strong></div></div><div className="order-actions"><button onClick={() => { setCounts((current) => [...current, { id: `manual-${String(current.length)}`, orderId: order.id, at: '2027-03-15T13:45:00Z', good: 120, scrap: 2, source: 'operator' }]) }}>Post counter event</button><button className="outline" onClick={completeBatch}>Complete batch</button></div></div></section></>}
      {activeConsole === 'timeline' && <><Heading kicker="MACHINE HISTORY" title="State timeline" detail="Overlapping state events are rejected before they reach this operating record." /><ProductionTimeline events={timeline} /></>}
      {activeConsole === 'quality' && <><Heading kicker="BATCH RELEASE" title="Quality gates" detail="Mandatory gates block completion even when the good count reaches target." /><QualityGatePanel gates={gates} onPass={(id) => { setGates((current) => current.map((gate) => gate.id === id ? { ...gate, result: 'passed' } : gate)) }} /></>}
      {activeConsole === 'materials' && <><Heading kicker="MATERIAL CONTROL" title="Staging plan" detail="Only released lots count toward bill-of-material availability." /><div className="material-board">{materials.map((item) => <article key={item.material}><span>{item.material}</span><h2>Valve housing alloy</h2><div><strong>{item.available} kg</strong><small>{item.required} kg required</small></div><b className={item.shortage ? 'shortage' : 'ready'}>{item.shortage ? `${String(item.shortage)} kg short` : 'ready to run'}</b></article>)}</div></>}
      {activeConsole === 'handoff' && <><Heading kicker="SHIFT CONTINUITY" title="Crew handoff" detail="Operational facts cross the shift boundary without rewriting the event timeline." /><div className="handoff-grid"><section><span>SHIFT OUTPUT</span><strong>{shiftSummary.good}</strong><p>good units · {shiftSummary.scrap} scrap</p></section><section><span>DOWNTIME</span><strong>{shiftSummary.downtimeMinutes} min</strong><p>tooling change on MX-04</p></section><section><span>OPEN CONSTRAINTS</span><strong>2</strong><p>PK-11 pallet sensor · final dimensional sample</p></section></div></>}
    </main></div>
}

function Heading({ kicker, title, detail }: { kicker: string; title: string; detail: string }) { return <div className="plant-heading"><span>{kicker}</span><h1>{title}</h1><p>{detail}</p></div> }
export default App
