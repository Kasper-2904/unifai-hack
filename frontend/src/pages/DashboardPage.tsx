import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getTeams } from '@/lib/api'
import { toApiErrorMessage } from '@/lib/apiClient'
import { useAuth } from '@/context/AuthContext'

export function DashboardPage() {
  const { user } = useAuth()

  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: getTeams,
  })

  if (teamsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-slate-500">Loading teams...</div>
      </div>
    )
  }

  if (teamsQuery.isError) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-600">
          {toApiErrorMessage(teamsQuery.error, 'Failed to load teams.')}
        </p>
      </div>
    )
  }

  const teams = teamsQuery.data ?? []

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome back{user?.full_name ? `, ${user.full_name}` : ''}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your teams and projects from here.
        </p>
      </div>

      {/* Teams Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-slate-800">Your Teams</h2>
          <Badge variant="outline" className="text-xs">
            {teams.length} {teams.length === 1 ? 'team' : 'teams'}
          </Badge>
        </div>

        {teams.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-slate-100 p-3 mb-4">
                <svg
                  className="w-6 h-6 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <p className="text-sm text-slate-600 mb-2">No teams yet</p>
              <p className="text-xs text-slate-400">
                Create your first team to get started with projects.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <Link key={team.id} to={`/teams/${team.id}`}>
                <Card className="h-full transition-all hover:shadow-md hover:border-slate-300 cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base font-medium">
                        {team.name}
                      </CardTitle>
                      {team.agent_count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {team.agent_count} agents
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs line-clamp-2">
                      {team.description || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>
                        Created {new Date(team.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Quick Links */}
      <section className="pt-4 border-t border-slate-200">
        <h3 className="text-sm font-medium text-slate-700 mb-3">Quick Links</h3>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/projects"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            All Projects
          </Link>
          <Link
            to="/tasks"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            My Tasks
          </Link>
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Marketplace
          </Link>
        </div>
      </section>
    </div>
  )
}

export default DashboardPage
