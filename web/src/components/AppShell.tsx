import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { useHomesList } from '../context/home'
import { Icon, LogoMark } from './Icon'

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { homeId } = useParams({ strict: false })

  return (
    <div className="shell">
      <header className="topbar">
        <button
          type="button"
          className="icon-btn"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} />
        </button>
        <Brand />
      </header>

      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <Brand />
        </div>
        <HomeSelector homeId={homeId} onNavigate={() => setMenuOpen(false)} />
        {homeId ? (
          <HomeNav homeId={homeId} onNavigate={() => setMenuOpen(false)} />
        ) : (
          <p className="sidebar-note">
            Pick or create a home to see its dashboard, bills and balances.
          </p>
        )}
        <p className="sidebar-foot">
          <Icon name="shield" size={16} />
          Payments are simulated. No money moves.
        </p>
      </aside>
      {menuOpen && (
        <button
          type="button"
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main className="main">{children}</main>
    </div>
  )
}

function Brand() {
  return (
    <Link to="/" className="brand">
      <LogoMark />
      <span>
        <strong>SplitNest</strong>
        <small>Shared living. Smarter splitting.</small>
      </span>
    </Link>
  )
}

function HomeSelector({
  homeId,
  onNavigate,
}: {
  homeId: string | undefined
  onNavigate: () => void
}) {
  const { homes: homesResource } = useHomesList()
  const navigate = useNavigate()
  const homes = homesResource.status === 'success' ? homesResource.data : []
  const known = homes.some((home) => home.id === homeId)
  const placeholder =
    homesResource.status === 'loading'
      ? 'Loading homes…'
      : homesResource.status === 'error'
        ? 'Homes unavailable'
        : 'All homes'

  return (
    <div className="home-select">
      <label htmlFor="home-select">Home</label>
      <select
        id="home-select"
        value={known && homeId ? homeId : ''}
        disabled={homesResource.status !== 'success'}
        onChange={(event) => {
          const next = event.target.value
          onNavigate()
          if (next) navigate({ to: '/homes/$homeId', params: { homeId: next } })
          else navigate({ to: '/' })
        }}
      >
        <option value="">{placeholder}</option>
        {homes.map((home) => (
          <option key={home.id} value={home.id}>
            {home.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function HomeNav({ homeId, onNavigate }: { homeId: string; onNavigate: () => void }) {
  const params = { homeId }
  return (
    <nav className="nav" aria-label="Home navigation">
      <Link
        to="/homes/$homeId"
        params={params}
        activeOptions={{ exact: true }}
        activeProps={{ className: 'active' }}
        onClick={onNavigate}
      >
        <Icon name="dashboard" /> Dashboard
      </Link>
      <Link
        to="/homes/$homeId/bills"
        params={params}
        activeProps={{ className: 'active' }}
        onClick={onNavigate}
      >
        <Icon name="receipt" /> Bills
      </Link>
      <Link
        to="/homes/$homeId/balances"
        params={params}
        activeProps={{ className: 'active' }}
        onClick={onNavigate}
      >
        <Icon name="wallet" /> Balances
      </Link>
      <Link
        to="/homes/$homeId/members"
        params={params}
        activeProps={{ className: 'active' }}
        onClick={onNavigate}
      >
        <Icon name="users" /> Members
      </Link>
    </nav>
  )
}
