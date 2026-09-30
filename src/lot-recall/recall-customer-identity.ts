import type { RecallAuthority, RecallPortfolioState, RecallCustomerAcknowledgement } from './recall-control-domain'

export interface RecallIdentityProposal {
  id: string
  acknowledgementId: string
  recallId: string
  originalCustomerId: string
  shipmentSourceId: string
  sourceRevision: number
  customerId: string
  evidence: string
  submittedBy: string
  submittedOn: string
  immutable: true
}
export interface RecallIdentityReview {
  id: string
  proposalId: string
  decision: 'accepted' | 'returned'
  evidence: string
  reviewer: string
  reviewedOn: string
  immutable: true
}
function validDate(value: string) {
  const date = new Date(value + 'T00:00:00Z')
  return /^20\d{2}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime())
    && date.toISOString().slice(0, 10) === value
}
function sourceIsReviewed(state: RecallPortfolioState, id: string, revision: number) {
  const source = state.shipmentSources.find((item) => item.id === id && item.sourceRevision === revision)
  if (!source) return null
  return source.sourceDocument.trim() || state.legacyShipmentReviews.some((review) =>
    review.shipmentSourceId === id && review.sourceRevision === revision && review.decision === 'accepted') ? source : null
}
export function resolvedRecallAcknowledgements(state: RecallPortfolioState): RecallCustomerAcknowledgement[] {
  return state.acknowledgements.map((ack) => {
    const proposal = (state.identityProposals ?? []).find((item) => item.acknowledgementId === ack.id
      && (state.identityReviews ?? []).some((review) => review.proposalId === item.id && review.decision === 'accepted'
        && review.reviewer !== item.submittedBy && review.evidence.trim() && validDate(review.reviewedOn)
        && review.reviewedOn >= item.submittedOn))
    const source = proposal ? sourceIsReviewed(state, proposal.shipmentSourceId, proposal.sourceRevision) : null
    if (!proposal || !source || proposal.originalCustomerId !== ack.customerId
      || proposal.recallId !== ack.recallId || source.recallId !== ack.recallId || source.customerId !== proposal.customerId) return ack
    return { ...ack, customerId: source.customerId, identityBasis: 'reviewed shipment',
      customerSources: [{ id: source.id, sourceRevision: source.sourceRevision }] }
  })
}
interface IdentityMeta { id: string; expectedRevision: number; authority: RecallAuthority }
export function proposeRecallCustomerIdentity(state: RecallPortfolioState, command: IdentityMeta & {
  acknowledgementId: string; shipmentSourceId: string; sourceRevision: number; evidence: string; submittedBy: string; submittedOn: string
}) {
  if ((state.identityProposals ?? []).some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Recall changed before identity reconciliation. Refresh and retain the draft.')
  if (command.authority !== 'Quality Analyst') throw new Error('Only a quality analyst can propose customer identity reconciliation.')
  const ack = state.acknowledgements.find((item) => item.id === command.acknowledgementId)
  const source = sourceIsReviewed(state, command.shipmentSourceId, command.sourceRevision)
  if (!ack || source?.recallId !== ack.recallId || ack.identityBasis === 'reviewed shipment'
    || ack.customerId === source.customerId || state.closures.some((item) => item.recallId === ack.recallId)) {
    throw new Error('An open legacy acknowledgement and reviewed shipment for the same recall are required.')
  }
  if (state.customerDispositions.some((item) => item.acknowledgementId === ack.id)) {
    throw new Error('Receipt already supports customer disposition evidence and cannot be repurposed.')
  }
  if ((state.identityProposals ?? []).some((item) => item.acknowledgementId === ack.id
    && !(state.identityReviews ?? []).some((review) => review.proposalId === item.id && review.decision === 'returned'))) {
    throw new Error('This receipt already has pending or accepted identity reconciliation.')
  }
  if (!command.id.trim() || command.evidence.trim().length < 10 || !command.submittedBy.trim()
    || !validDate(command.submittedOn) || command.submittedOn < ack.acknowledgedOn) {
    throw new Error('Named investigator, source evidence and a valid date after the receipt are required.')
  }
  const next = structuredClone(state)
  next.identityProposals = [...(state.identityProposals ?? []), {
    id: command.id, acknowledgementId: ack.id, recallId: ack.recallId, originalCustomerId: ack.customerId,
    shipmentSourceId: source.id, sourceRevision: source.sourceRevision, customerId: source.customerId,
    evidence: command.evidence.trim(), submittedBy: command.submittedBy.trim(), submittedOn: command.submittedOn, immutable: true,
  }]
  next.revision += 1
  return next
}
export function reviewRecallCustomerIdentity(state: RecallPortfolioState, command: IdentityMeta & {
  identityProposalId: string; decision: RecallIdentityReview['decision']; evidence: string; reviewer: string; reviewedOn: string
}) {
  if ((state.identityReviews ?? []).some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Recall changed before identity review. Refresh and retain the draft.')
  if (command.authority !== 'Quality Director') throw new Error('Only the quality director can review customer identity reconciliation.')
  const proposal = (state.identityProposals ?? []).find((item) => item.id === command.identityProposalId)
  const ack = state.acknowledgements.find((item) => item.id === proposal?.acknowledgementId)
  const source = proposal ? sourceIsReviewed(state, proposal.shipmentSourceId, proposal.sourceRevision) : null
  if (!proposal || !ack || source?.customerId !== proposal.customerId || source.recallId !== proposal.recallId
    || ack.customerId !== proposal.originalCustomerId || ack.recallId !== proposal.recallId
    || state.closures.some((item) => item.recallId === proposal.recallId)
    || (state.identityReviews ?? []).some((item) => item.proposalId === proposal.id)) {
    throw new Error('An unreviewed identity proposal with unchanged receipt and shipment evidence is required.')
  }
  if (!command.id.trim() || !command.reviewer.trim() || command.reviewer.trim() === proposal.submittedBy
    || command.evidence.trim().length < 10 || !validDate(command.reviewedOn) || command.reviewedOn < proposal.submittedOn) {
    throw new Error('Independent reviewer, evidence and a valid review date are required.')
  }
  if (command.decision === 'accepted' && state.customerDispositions.some((item) => item.acknowledgementId === ack.id)) {
    throw new Error('Receipt acquired downstream disposition evidence after proposal and cannot be repurposed.')
  }
  if (command.decision === 'accepted' && resolvedRecallAcknowledgements(state).some((item) =>
    item.id !== ack.id && item.recallId === ack.recallId && item.customerId === source.customerId)) {
    throw new Error('Another receipt already acknowledges the authoritative customer; duplicate coverage is prohibited.')
  }
  const next = structuredClone(state)
  next.identityReviews = [...(state.identityReviews ?? []), { id: command.id, proposalId: proposal.id,
    decision: command.decision, evidence: command.evidence.trim(), reviewer: command.reviewer.trim(),
    reviewedOn: command.reviewedOn, immutable: true }]
  next.revision += 1
  return next
}
