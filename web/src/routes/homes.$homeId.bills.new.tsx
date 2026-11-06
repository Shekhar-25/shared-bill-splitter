import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useId, useState } from 'react'
import { splitCents } from '../../../api/src/split'
import { Avatar, Banner, Button, Card, Field, PageHeader } from '../components/ui'
import { useHome, useHomesList } from '../context/home'
import { useToast } from '../context/toast'
import { ApiError, createBill, type Member } from '../lib/api'
import { formatCents, parseAmountToCents } from '../lib/money'

export const Route = createFileRoute('/homes/$homeId/bills/new')({
  component: NewBillPage,
})

function NewBillPage() {
  const { home } = useHome()
  const { homes } = useHomesList()
  const navigate = useNavigate()
  const showToast = useToast()
  const ids = { home: useId(), title: useId(), amount: useId() }

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [touched, setTouched] = useState(false)
  const [pending, setPending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const titleError = touched && title.trim() === '' ? 'Give the bill a title.' : null
  const parsed = parseAmountToCents(amount)
  const amountError = touched && 'error' in parsed ? parsed.error : null
  const noMembers = home.members.length === 0
  const canSubmit = title.trim() !== '' && 'cents' in parsed && !noMembers

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setTouched(true)
    if (!canSubmit || !('cents' in parsed)) return

    setPending(true)
    setServerError(null)
    try {
      const bill = await createBill(home.id, title.trim(), parsed.cents)
      showToast('success', `${title.trim()} split between ${home.members.length} members.`)
      await navigate({
        to: '/homes/$homeId/bills/$billId',
        params: { homeId: home.id, billId: bill.id },
      })
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'Something went wrong.')
      setPending(false)
    }
  }

  return (
    <>
      <PageHeader
        title="New bill"
        subtitle="Enter the total. We split it fairly between members."
      />
      <div className="grid-2">
        <Card title="Bill details">
          <form className="stack" onSubmit={handleSubmit} noValidate>
            <Field label="Home" htmlFor={ids.home}>
              <select
                id={ids.home}
                value={home.id}
                onChange={(event) =>
                  navigate({
                    to: '/homes/$homeId/bills/new',
                    params: { homeId: event.target.value },
                  })
                }
              >
                {homes.status === 'success' ? (
                  homes.data.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))
                ) : (
                  <option value={home.id}>{home.name}</option>
                )}
              </select>
            </Field>
            <Field label="Title" htmlFor={ids.title} error={titleError}>
              <input
                id={ids.title}
                value={title}
                maxLength={120}
                placeholder="e.g. Electricity"
                autoComplete="off"
                aria-invalid={titleError !== null}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            <Field
              label="Total amount"
              htmlFor={ids.amount}
              error={amountError}
              hint="In dollars, up to 2 decimals. Stored internally as whole cents."
            >
              <div className="input-prefix">
                <span aria-hidden="true">$</span>
                <input
                  id={ids.amount}
                  value={amount}
                  inputMode="decimal"
                  placeholder="0.00"
                  autoComplete="off"
                  aria-invalid={amountError !== null}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
            </Field>
            {serverError && <Banner tone="error">{serverError}</Banner>}
            <Button type="submit" icon="check" loading={pending} disabled={noMembers}>
              Create bill
            </Button>
          </form>
        </Card>

        <Card title="How it will be split">
          <SplitPreview
            members={home.members}
            cents={'cents' in parsed ? parsed.cents : null}
            homeId={home.id}
          />
        </Card>
      </div>
    </>
  )
}

function SplitPreview({
  members,
  cents,
  homeId,
}: {
  members: Member[]
  cents: number | null
  homeId: string
}) {
  if (members.length === 0) {
    return (
      <Banner tone="warning">
        This home has no members, so a bill cannot be split.{' '}
        <Link to="/homes/$homeId/members" params={{ homeId }}>
          Add members
        </Link>
      </Banner>
    )
  }
  if (cents === null) {
    return <p className="muted">Enter a valid amount to see each member's share.</p>
  }

  // The same function the API uses, so the preview always matches what gets saved.
  const shares = splitCents(cents, members.length)
  return (
    <>
      <p className="muted">
        {formatCents(cents)} between {members.length} {members.length === 1 ? 'member' : 'members'}.
        Extra cents go to the earliest members.
      </p>
      <ul className="list">
        {members.map((member, index) => (
          <li key={member.id} className="list-row">
            <Avatar name={member.name} />
            <span className="grow">
              <strong>{member.name}</strong>
            </span>
            <span className="amount">{formatCents(shares[index] ?? 0)}</span>
          </li>
        ))}
      </ul>
      <p className="split-total">
        <span>Total</span>
        <span className="amount">{formatCents(shares.reduce((sum, share) => sum + share, 0))}</span>
      </p>
    </>
  )
}
