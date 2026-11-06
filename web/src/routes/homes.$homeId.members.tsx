import { createFileRoute } from '@tanstack/react-router'
import { NameForm } from '../components/NameForm'
import { Avatar, Card, EmptyState, PageHeader } from '../components/ui'
import { useHome } from '../context/home'
import { useToast } from '../context/toast'
import { addMember } from '../lib/api'

export const Route = createFileRoute('/homes/$homeId/members')({
  component: MembersPage,
})

function MembersPage() {
  const { home, reloadHome } = useHome()
  const showToast = useToast()

  async function handleAdd(name: string) {
    const member = await addMember(home.id, name)
    reloadHome()
    showToast('success', `${member.name} joined ${home.name}.`)
  }

  return (
    <>
      <PageHeader
        title="Members"
        subtitle="Bills are split between members in the order they were added."
      />
      <div className="grid-2">
        <Card title={`People in ${home.name}`}>
          {home.members.length === 0 ? (
            <EmptyState
              icon="users"
              title="No members yet"
              description="Add the first member. Bills can only be created once a home has members."
            />
          ) : (
            <ol className="list">
              {home.members.map((member, index) => (
                <li key={member.id} className="list-row">
                  <span className="order-badge">{index + 1}</span>
                  <Avatar name={member.name} />
                  <span className="grow">
                    <strong>{member.name}</strong>
                    {index === 0 && <small className="muted">Receives extra cents first</small>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card title="Add a member">
          <NameForm
            label="Member name"
            placeholder="e.g. Asha"
            submitLabel="Add member"
            onSubmit={handleAdd}
          />
        </Card>
      </div>
    </>
  )
}
