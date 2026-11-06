import { createFileRoute, Link } from '@tanstack/react-router'
import { BillList } from '../components/BillList'
import { Icon } from '../components/Icon'
import { ResourceView } from '../components/ResourceView'
import { Card, EmptyState, ListSkeleton, PageHeader } from '../components/ui'
import { useHome } from '../context/home'
import { useBills } from '../hooks/useHomeData'

export const Route = createFileRoute('/homes/$homeId/bills/')({
  component: BillsPage,
})

function BillsPage() {
  const { home } = useHome()
  const bills = useBills(home.id)

  return (
    <>
      <PageHeader
        title="Bills"
        subtitle={`Every bill split in ${home.name}, newest first.`}
        actions={
          <Link
            to="/homes/$homeId/bills/new"
            params={{ homeId: home.id }}
            className="btn btn-primary"
          >
            <Icon name="plus" size={18} /> New bill
          </Link>
        }
      />
      <Card>
        <ResourceView
          resource={bills.state}
          onRetry={bills.reload}
          skeleton={<ListSkeleton rows={4} />}
        >
          {(list) =>
            list.length === 0 ? (
              <EmptyState
                icon="receipt"
                title="No bills yet"
                description={
                  home.members.length === 0
                    ? 'Add members to this home first, then create a bill.'
                    : 'Create your first bill to split it between everyone.'
                }
              />
            ) : (
              <BillList bills={list} />
            )
          }
        </ResourceView>
      </Card>
    </>
  )
}
