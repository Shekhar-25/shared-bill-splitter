import { createFileRoute } from '@tanstack/react-router'
import { ResourceView } from '../components/ResourceView'
import { Avatar, Card, EmptyState, ListSkeleton, PageHeader } from '../components/ui'
import { useHome } from '../context/home'
import { useBalances, useBills } from '../hooks/useHomeData'
import type { Balance, Bill, Member } from '../lib/api'
import { formatCents } from '../lib/money'
import { type MemberSummary, summarizeMembers } from '../lib/summary'

export const Route = createFileRoute('/homes/$homeId/balances')({
  component: BalancesPage,
})

function BalancesPage() {
  const { home } = useHome()
  const balances = useBalances(home.id)
  const bills = useBills(home.id)

  return (
    <>
      <PageHeader title="Balances" subtitle="What each member still owes across all bills." />
      <Card>
        <ResourceView
          resource={balances.state}
          onRetry={balances.reload}
          skeleton={<ListSkeleton rows={4} />}
        >
          {(list) =>
            list.length === 0 ? (
              <EmptyState
                icon="users"
                title="No members to show"
                description="Add members to this home to track what they owe."
              />
            ) : (
              <>
                <Summary balances={list} />
                <ResourceView
                  resource={bills.state}
                  onRetry={bills.reload}
                  skeleton={<ListSkeleton rows={list.length} />}
                >
                  {(billList) => (
                    <MemberTable balances={list} bills={billList} members={home.members} />
                  )}
                </ResourceView>
              </>
            )
          }
        </ResourceView>
      </Card>
    </>
  )
}

function Summary({ balances }: { balances: Balance[] }) {
  const total = balances.reduce((sum, balance) => sum + balance.outstandingCents, 0)
  const settled = balances.filter((balance) => balance.outstandingCents === 0).length
  return (
    <div className="stats stats-inline">
      <div className="stat">
        <span className="stat-label">Total outstanding</span>
        <span className={`stat-value ${total > 0 ? 'due-text' : 'paid-text'}`}>
          {formatCents(total)}
        </span>
      </div>
      <div className="stat">
        <span className="stat-label">Settled members</span>
        <span className="stat-value">
          {settled}/{balances.length}
        </span>
      </div>
    </div>
  )
}

function MemberTable({
  balances,
  bills,
  members,
}: {
  balances: Balance[]
  bills: Bill[]
  members: Member[]
}) {
  const summaries = new Map<string, MemberSummary>(
    summarizeMembers(members, bills).map((summary) => [summary.memberId, summary]),
  )
  return (
    <ul className="list">
      {balances.map((balance) => {
        const summary = summaries.get(balance.memberId)
        const totalShares = summary?.totalShares ?? 0
        const paidShares = summary?.paidShares ?? 0
        const progress = totalShares === 0 ? 0 : Math.round((paidShares / totalShares) * 100)
        return (
          <li key={balance.memberId} className="list-row balance-row">
            <Avatar name={balance.name} />
            <span className="grow">
              <strong>{balance.name}</strong>
              <small className="muted">
                {totalShares === 0
                  ? 'No bills yet'
                  : `${paidShares} of ${totalShares} shares paid · ${formatCents(summary?.paidCents ?? 0)} paid`}
              </small>
              <span className="progress" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
              </span>
            </span>
            {balance.outstandingCents === 0 ? (
              <span className="settled">Settled</span>
            ) : (
              <span className="amount due-text">{formatCents(balance.outstandingCents)}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
