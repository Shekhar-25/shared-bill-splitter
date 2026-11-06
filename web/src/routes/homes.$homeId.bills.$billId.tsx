import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Icon } from '../components/Icon'
import { ResourceView } from '../components/ResourceView'
import {
  Avatar,
  Banner,
  Button,
  Card,
  ErrorState,
  ListSkeleton,
  PageHeader,
  StatusPill,
} from '../components/ui'
import { useHome } from '../context/home'
import { useToast } from '../context/toast'
import { useBill } from '../hooks/useHomeData'
import { ApiError, type Bill, type Member, payShare, type Share } from '../lib/api'
import { paymentKeyFor, settlePayment } from '../lib/idempotency'
import { formatCents } from '../lib/money'
import { formatDate, outstandingOfBill } from '../lib/summary'

export const Route = createFileRoute('/homes/$homeId/bills/$billId')({
  component: BillPage,
})

function BillPage() {
  const { home } = useHome()
  const { billId } = Route.useParams()
  const { state, reload } = useBill(billId)

  return (
    <ResourceView resource={state} onRetry={reload} skeleton={<ListSkeleton rows={4} />}>
      {(bill) =>
        bill.homeId === home.id ? (
          <BillDetails bill={bill} members={home.members} reload={reload} />
        ) : (
          <ErrorState title="Not found" message="This bill does not belong to the selected home." />
        )
      }
    </ResourceView>
  )
}

function BillDetails({
  bill,
  members,
  reload,
}: {
  bill: Bill
  members: Member[]
  reload: () => void
}) {
  const showToast = useToast()
  const [confirming, setConfirming] = useState<Share | null>(null)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const outstanding = outstandingOfBill(bill)
  const memberName = (memberId: string) =>
    members.find((member) => member.id === memberId)?.name ?? 'Former member'

  function closeDialog() {
    setConfirming(null)
    setPayError(null)
  }

  async function confirmPayment(share: Share) {
    if (paying) return // a second click while a payment is in flight does nothing
    setPaying(true)
    setPayError(null)
    try {
      // Same key on every retry of this logical payment (see lib/idempotency.ts).
      await payShare(bill.id, share.id, paymentKeyFor(share.id))
      settlePayment(share.id)
      showToast('success', `${memberName(share.memberId)}'s share is marked as paid.`)
      closeDialog()
      reload()
    } catch (error) {
      if (error instanceof ApiError && error.status !== null && error.status < 500) {
        // The server gave a final answer (e.g. 409 already paid), so a fresh attempt may use a new key.
        settlePayment(share.id)
        if (error.status === 409 || error.status === 404) reload()
      }
      setPayError(
        error instanceof ApiError
          ? error.status === 409
            ? 'This share was already paid by another request. The list has been refreshed.'
            : error.message
          : 'Something went wrong.',
      )
    } finally {
      setPaying(false)
    }
  }

  return (
    <>
      <PageHeader
        title={bill.title}
        subtitle={`Created ${formatDate(bill.createdAt)}`}
        actions={
          <Link
            to="/homes/$homeId/bills"
            params={{ homeId: bill.homeId }}
            className="btn btn-secondary"
          >
            <Icon name="receipt" size={18} /> All bills
          </Link>
        }
      />

      <div className="stats">
        <div className="stat">
          <span className="stat-label">Total</span>
          <span className="stat-value">{formatCents(bill.totalCents)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Outstanding</span>
          <span className={`stat-value ${outstanding > 0 ? 'due-text' : 'paid-text'}`}>
            {formatCents(outstanding)}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Shares paid</span>
          <span className="stat-value">
            {bill.shares.filter((share) => share.paidAt !== null).length}/{bill.shares.length}
          </span>
        </div>
      </div>

      <Card title="Shares">
        <ul className="list">
          {bill.shares.map((share) => {
            const paid = share.paidAt !== null
            return (
              <li key={share.id} className={`list-row share-row ${paid ? 'share-paid' : ''}`}>
                <Avatar name={memberName(share.memberId)} />
                <span className="grow">
                  <strong>{memberName(share.memberId)}</strong>
                  <small className="muted">
                    {share.paidAt ? `Paid ${formatDate(share.paidAt)}` : 'Waiting for payment'}
                  </small>
                </span>
                <span className="amount">{formatCents(share.amountCents)}</span>
                <StatusPill paid={paid} />
                {!paid && (
                  <Button variant="secondary" onClick={() => setConfirming(share)}>
                    Pay share
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      {confirming && (
        <ConfirmDialog
          title="Confirm payment"
          confirmLabel={payError ? 'Try again' : `Pay ${formatCents(confirming.amountCents)}`}
          busy={paying}
          onConfirm={() => confirmPayment(confirming)}
          onCancel={closeDialog}
        >
          <p>
            Mark <strong>{memberName(confirming.memberId)}</strong>'s share of{' '}
            <strong>{formatCents(confirming.amountCents)}</strong> for “{bill.title}” as paid?
          </p>
          <Banner tone="info">
            This assignment simulates payment status only. No real payment gateway is used and no
            money moves.
          </Banner>
          {paying && <p className="muted">Processing. Please do not close this window…</p>}
          {payError && <Banner tone="error">{payError}</Banner>}
        </ConfirmDialog>
      )}
    </>
  )
}
