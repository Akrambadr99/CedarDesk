import type { MachineState } from './production'

interface Machine { id: string; name: string; state: MachineState; rate: number }
export function MachineStateStrip({ machines }: { machines: readonly Machine[] }) {
  return <div className="machine-strip">{machines.map((machine) => <article key={machine.id} className={machine.state}><header><span>{machine.id}</span><b>{machine.state}</b></header><h2>{machine.name}</h2><div><strong>{machine.rate}</strong><span>units / hour</span></div></article>)}</div>
}
