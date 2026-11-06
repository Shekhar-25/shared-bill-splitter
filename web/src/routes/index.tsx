import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { NameForm } from '../components/NameForm'
import { ResourceView } from '../components/ResourceView'
import { Card, EmptyState, ListSkeleton, PageHeader } from '../components/ui'
import { useHomesList } from '../context/home'
import { useToast } from '../context/toast'
import { createHome } from '../lib/api'
import { formatDate } from '../lib/summary'

export const Route = createFileRoute('/')({
  component: HomesPage,
})

function HomesPage() {
  const { homes, reloadHomes } = useHomesList()
  const navigate = useNavigate()
  const showToast = useToast()

  async function handleCreate(name: string) {
    const home = await createHome(name)
    reloadHomes()
    showToast('success', `${home.name} created. Add its members next.`)
    await navigate({ to: '/homes/$homeId/members', params: { homeId: home.id } })
  }

  return (
    <>
      <PageHeader
        title="Your homes"
        subtitle="Create a home, add the people who live there, then split bills fairly."
      />
      <div className="grid-2">
        <Card title="All homes">
          <ResourceView resource={homes} onRetry={reloadHomes} skeleton={<ListSkeleton rows={3} />}>
            {(list) =>
              list.length === 0 ? (
                <EmptyState
                  icon="home"
                  title="No homes yet"
                  description="Create your first home with the form to start splitting bills."
                />
              ) : (
                <ul className="list">
                  {list.map((home) => (
                    <li key={home.id}>
                      <Link
                        to="/homes/$homeId"
                        params={{ homeId: home.id }}
                        className="list-row list-link"
                      >
                        <span className="list-icon">
                          <span className="logo-dot" />
                        </span>
                        <span className="grow">
                          <strong>{home.name}</strong>
                          <small className="muted">Created {formatDate(home.createdAt)}</small>
                        </span>
                        <span className="muted">Open</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            }
          </ResourceView>
        </Card>
        <Card title="Create a home">
          <NameForm
            label="Home name"
            placeholder="e.g. Flat 4B"
            submitLabel="Create home"
            onSubmit={handleCreate}
          />
        </Card>
      </div>
    </>
  )
}
