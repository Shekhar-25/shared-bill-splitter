import type { Bill, Member } from './api'

export type MemberSummary = {
  memberId: string
  name: string
  paidShares: number
  totalShares: number
  paidCents: number
  outstandingCents: number
}

/** Per-member payment summary derived from the bills the API returned. */
export function summarizeMembers(members: Member[], bills: Bill[]): MemberSummary[] {
  return members.map((member) => {
    const summary: MemberSummary = {
      memberId: member.id,
      name: member.name,
      paidShares: 0,
      totalShares: 0,
      paidCents: 0,
      outstandingCents: 0,
    }
    for (const bill of bills) {
      for (const share of bill.shares) {
        if (share.memberId !== member.id) continue
        summary.totalShares += 1
        if (share.paidAt === null) {
          summary.outstandingCents += share.amountCents
        } else {
          summary.paidShares += 1
          summary.paidCents += share.amountCents
        }
      }
    }
    return summary
  })
}

export function outstandingOfBill(bill: Bill): number {
  return bill.shares.reduce(
    (sum, share) => (share.paidAt === null ? sum + share.amountCents : sum),
    0,
  )
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
