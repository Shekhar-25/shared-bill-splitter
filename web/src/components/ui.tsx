import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

// ---------- Button ----------

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'success'
  loading?: boolean
  icon?: IconName
}

export function Button({
  variant = 'primary',
  loading = false,
  icon,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn-${variant}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading ? (
        <span className="spinner" aria-hidden="true" />
      ) : (
        icon && <Icon name={icon} size={18} />
      )}
      {children}
    </button>
  )
}

// ---------- Form field ----------

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="field-hint">{hint}</p>
      )}
    </div>
  )
}

// ---------- Feedback ----------

export function Banner({
  tone,
  children,
}: {
  tone: 'success' | 'error' | 'info' | 'warning'
  children: ReactNode
}) {
  const icon: IconName = tone === 'success' ? 'check' : tone === 'info' ? 'shield' : 'alert'
  return (
    <div className={`banner banner-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={icon} size={18} />
      <div>{children}</div>
    </div>
  )
}

export function Skeleton({ width, height = 16 }: { width?: number | string; height?: number }) {
  return <span className="skeleton" style={{ width, height }} aria-hidden="true" />
}

export function ListSkeleton({ rows }: { rows: number }) {
  const placeholders = Array.from({ length: rows }, (_, index) => index)
  return (
    <div className="stack">
      {placeholders.map((placeholder) => (
        <Skeleton key={placeholder} height={52} />
      ))}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string
  description: string
  icon: IconName
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty-art" aria-hidden="true">
        <span className="empty-ring empty-ring-outer" />
        <span className="empty-ring empty-ring-inner" />
        <Icon name={icon} size={26} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  offline = false,
  onRetry,
}: {
  title?: string
  message: string
  offline?: boolean
  onRetry?: () => void
}) {
  return (
    <div className="empty empty-error" role="alert">
      <div className="empty-art" aria-hidden="true">
        <span className="empty-ring empty-ring-outer" />
        <span className="empty-ring empty-ring-inner" />
        <Icon name={offline ? 'cloudOff' : 'alert'} size={26} />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && (
        <Button variant="secondary" icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

// ---------- Small display pieces ----------

export function Avatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  // A stable hue per name, so each person keeps their colour everywhere.
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return (
    <span
      className="avatar"
      style={{ background: `hsl(${hash} 38% 90%)`, color: `hsl(${hash} 40% 28%)` }}
    >
      {initial}
    </span>
  )
}

export function StatusPill({ paid }: { paid: boolean }) {
  return (
    <span className={`pill ${paid ? 'pill-paid' : 'pill-due'}`}>
      <Icon name={paid ? 'check' : 'clock'} size={14} />
      {paid ? 'Paid' : 'Outstanding'}
    </span>
  )
}

export function Card({
  title,
  action,
  children,
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="card">
      {(title || action) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}
