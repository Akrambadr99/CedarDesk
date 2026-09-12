import type { QualityGate } from './production';
export function QualityGatePanel({ gates, onPass }: {
    gates: QualityGate[];
    onPass: (id: string) => void;
}) {
    return <div className="quality-gates">{gates.map((gate, index) => <article key={gate.id}><div className="gate-index">{String(index + 1).padStart(2, '0')}</div><div><span>{gate.required ? 'MANDATORY RELEASE CONTROL' : 'PROCESS CHECK'}</span><h2>{gate.name}</h2><p>Result is written to the immutable batch traceability packet.</p></div><button className={gate.result} onClick={() => { onPass(gate.id); }} disabled={gate.result === 'passed'}>{gate.result === 'passed' ? 'Passed' : 'Record pass'}</button></article>)}</div>;
}
