export const recallEffectivenessPolicy={criticalAgeDays:10,minimumCoveragePercent:80} as const;export interface RecallWorkload{recallId:string;owner:string;openedOn:string;tracedUnits:number;recoveredUnits:number;quarantinedUnits:number;customerCount:number;genealogyReference:string;escalated:boolean}
export const seededRecallWorkload:RecallWorkload[]=[{recallId:'RECALL-SEAL-B88',owner:'Customer recovery team',openedOn:'2026-10-08',tracedUnits:45,recoveredUnits:0,quarantinedUnits:55,customerCount:2,genealogyReference:'SEAL-B88',escalated:true},{recallId:'RECALL-VALVE-C14',owner:'Valve quality cell',openedOn:'2026-10-15',tracedUnits:80,recoveredUnits:68,quarantinedUnits:22,customerCount:4,genealogyReference:'VALVE-C14',escalated:false},{recallId:'RECALL-SHAFT-A03',owner:'Machining quality',openedOn:'2026-10-18',tracedUnits:30,recoveredUnits:30,quarantinedUnits:0,customerCount:1,genealogyReference:'SHAFT-A03',escalated:false}];
export function rankRecallWorkload(records: RecallWorkload[], asOf: string) {
  const priorityRank = { critical: 0, watch: 1, healthy: 2 } as const
  return records.map((record) => {
    if (record.recoveredUnits > record.tracedUnits) throw new Error('Recovered units cannot exceed traced population.')
    const ageDays = Math.floor((Date.parse(asOf) - Date.parse(record.openedOn)) / 86_400_000)
    const coveragePercent = Math.round((record.recoveredUnits / record.tracedUnits) * 100)
    const priority: keyof typeof priorityRank = ageDays >= recallEffectivenessPolicy.criticalAgeDays && coveragePercent < recallEffectivenessPolicy.minimumCoveragePercent ? 'critical' : coveragePercent < 100 ? 'watch' : 'healthy'
    return { ...record, ageDays, coveragePercent, unrecoveredUnits: record.tracedUnits - record.recoveredUnits, priority }
  }).sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || b.unrecoveredUnits - a.unrecoveredUnits)
}
