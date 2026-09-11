import type { MachineEvent } from './production'

const start = new Date('2027-03-15T06:00:00Z').getTime()
const total = 8 * 60 * 60 * 1000
export function ProductionTimeline({ events }: { events: MachineEvent[] }) {
  return <section className="production-timeline"><header><span>06:00</span><span>08:00</span><span>10:00</span><span>12:00</span><span>14:00</span></header><div className="timeline-track">{events.map((event) => {
    const left = (new Date(event.startedAt).getTime() - start) / total * 100
    const end = event.endedAt ? new Date(event.endedAt).getTime() : start + total
    const width = (end - new Date(event.startedAt).getTime()) / total * 100
    return <button key={event.id} className={event.state} style={{ left: `${String(left)}%`, width: `${String(width)}%` }} title={event.reason}><strong>{event.state}</strong><span>{event.reason}</span></button>
  })}</div></section>
}
