import { createFileRoute, Link } from '@tanstack/react-router'
import { BillList } from '../components/BillList'
import { Icon } from '../components/Icon'
import { ResourceView } from '../components/ResourceView'
import {
  Avatar,
  Banner,
  Card,
  EmptyState,
  ListSkeleton,
  PageHeader,
  Skeleton,
} from '../components/ui'
import { useHome } from '../context/home'
import { useBalances, useBills } from '../hooks/useHomeData'
import { formatCents } from '../lib/money'

export const Route = createFileRoute('/homes/$homeId/')({
  component: Dashboard,
})

const RECENT_BILL_COUNT = 5

function Dashboard() {
  const { home } = useHome()
  const bills = useBills(home.id)
  const balances = useBalances(home.id)

  const outstandingTotal =
    balances.state.status === 'success'
      ? balances.state.data.reduce((sum, balance) => sum + balance.outstandingCents, 0)
      : null

  return (
    <>
      <PageHeader
        title={home.name}
        subtitle="Overview of what is owed and what has been paid."
        actions={
          <>
            <Link
              to="/homes/$homeId/members"
              params={{ homeId: home.id }}
              className="btn btn-secondary"
            >
              <Icon name="users" size={18} /> Add member
            </Link>
            <Link
              to="/homes/$homeId/bills/new"
              params={{ homeId: home.id }}
              className="btn btn-primary"
            >
              <Icon name="plus" size={18} /> New bill
            </Link>
          </>
        }
      />

      <HomeIdChip id={home.id} />

      {home.members.length === 0 && (
        <Banner tone="info">
          This home has no members yet. Add at least one member before creating a bill.
        </Banner>
      )}

      <div className="stats">
        <Stat
          label="Total outstanding"
          tone="due"
          value={outstandingTotal === null ? null : formatCents(outstandingTotal)}
          failed={balances.state.status === 'error'}
        />
        <Stat
          label="Bills created"
          value={bills.state.status === 'success' ? String(bills.state.data.length) : null}
          failed={bills.state.status === 'error'}
        />
        <Stat label="Members" value={String(home.members.length)} />
      </div>

      <div className="grid-2">
        <Card
          title="Recent bills"
          action={
            <Link to="/homes/$homeId/bills" params={{ homeId: home.id }} className="link-quiet">
              View all
            </Link>
          }
        >
          <ResourceView
            resource={bills.state}
            onRetry={bills.reload}
            skeleton={<ListSkeleton rows={3} />}
          >
            {(list) =>
              list.length === 0 ? (
                <EmptyState
                  icon="receipt"
                  title="No bills yet"
                  description={
                    home.members.length === 0
                      ? 'Add members first, then create the first bill.'
                      : 'Create a bill to split it between everyone.'
                  }
                />
              ) : (
                <BillList bills={list.slice(0, RECENT_BILL_COUNT)} />
              )
            }
          </ResourceView>
        </Card>

        <Card
          title="Outstanding payments"
          action={
            <Link to="/homes/$homeId/balances" params={{ homeId: home.id }} className="link-quiet">
              Details
            </Link>
          }
        >
          <ResourceView
            resource={balances.state}
            onRetry={balances.reload}
            skeleton={<ListSkeleton rows={3} />}
          >
            {(list) =>
              list.length === 0 ? (
                <EmptyState
                  icon="users"
                  title="No members"
                  description="Balances appear once the home has members."
                />
              ) : (
                <ul className="list">
                  {list.map((balance) => (
                    <li key={balance.memberId} className="list-row">
                      <Avatar name={balance.name} />
                      <span className="grow">
                        <strong>{balance.name}</strong>
                      </span>
                      {balance.outstandingCents === 0 ? (
                        <span className="settled">Settled</span>
                      ) : (
                        <span className="amount due-text">
                          {formatCents(balance.outstandingCents)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )
            }
          </ResourceView>
        </Card>
      </div>
    </>
  )
}

function Stat({
  label,
  value,
  tone,
  failed = false,
}: {
  label: string
  value: string | null
  tone?: 'due'
  failed?: boolean
}) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      {failed ? (
        <span className="stat-value muted">Unavailable</span>
      ) : value === null ? (
        <Skeleton width={110} height={32} />
      ) : (
        <span className={`stat-value ${tone === 'due' ? 'due-text' : ''}`}>{value}</span>
      )}
    </div>
  )
}

function HomeIdChip({ id }: { id: string }) {
  return (
    <p className="id-chip">
      Home ID <code>{id}</code>
      <button
        type="button"
        className="icon-btn icon-btn-small"
        aria-label="Copy home ID"
        onClick={() => void navigator.clipboard?.writeText(id).catch(() => undefined)}
      >
        <Icon name="copy" size={15} />
      </button>
    </p>
  )
}
