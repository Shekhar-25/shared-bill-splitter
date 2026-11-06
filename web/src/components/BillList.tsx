import { Link } from '@tanstack/react-router'
import type { Bill } from '../lib/api'
import { formatCents } from '../lib/money'
import { formatDate, outstandingOfBill } from '../lib/summary'
import { Icon } from './Icon'
import { StatusPill } from './ui'

/** A list of bills; each row links to the bill's detail page. */
export function BillList({ bills }: { bills: Bill[] }) {
  return (
    <ul className="list">
      {bills.map((bill) => {
        const outstanding = outstandingOfBill(bill)
        const paidShares = bill.shares.filter((share) => share.paidAt !== null).length
        return (
          <li key={bill.id}>
            <Link
              to="/homes/$homeId/bills/$billId"
              params={{ homeId: bill.homeId, billId: bill.id }}
              className="list-row list-link"
            >
              <span className="list-icon">
                <Icon name="receipt" size={18} />
              </span>
              <span className="grow">
                <strong>{bill.title}</strong>
                <small className="muted">
                  {formatDate(bill.createdAt)} · {paidShares}/{bill.shares.length} shares paid
                </small>
              </span>
              <span className="list-amount">
                <span className="amount">{formatCents(bill.totalCents)}</span>
                {outstanding === 0 ? (
                  <StatusPill paid />
                ) : (
                  <small className="due-text">{formatCents(outstanding)} outstanding</small>
                )}
              </span>
              <Icon name="chevron" size={16} />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
