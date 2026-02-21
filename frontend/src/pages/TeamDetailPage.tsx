import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getTeam, getTeamProjects } from '@/lib/api'
import { toApiErrorMessage } from '@/lib/apiClient'

export default function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>()

  const teamQuery = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => getTeam(teamId!),
    enabled: Boolean(teamId),
  })

  const projectsQuery = useQuery({
    queryKey: ['team-projects', teamId],
    queryFn: () => getTeamProjects(teamId!),
    enabled: Boolean(teamId),
  })

  if (!teamId) {
    return <p className="text-sm text-red-600">Team ID is missing.</p>
  }

  if (teamQuery.isLoading || projectsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-slate-500">Loading team...</div>
      </div>
    )
  }

  if (teamQuery.isError) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-600">
          {toApiErrorMessage(teamQuery.error, 'Failed to load team.')}
        </p>
      </div>
    )
  }

  const team = teamQuery.data
  const projects = projectsQuery.data ?? []

  if (!team) {
    return <p className="text-sm text-slate-600">Team not found.</p>
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link to="/dashboard" className="hover:text-slate-700">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-slate-900">{team.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{team.name}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {team.description || 'No description'}
            </p>
          </div>
          {team.agent_count > 0 && (
            <Badge variant="secondary">
              {team.agent_count} agents
            </Badge>
          )}
        </div>
      </div>

      {/* Projects Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-slate-800">Projects</h2>
          <Badge variant="outline" className="text-xs">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </Badge>
        </div>

        {projects.length === 0 ? (
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
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
              </div>
              <p className="text-sm text-slate-600 mb-2">No projects yet</p>
              <p className="text-xs text-slate-400">
                Create your first project to start tracking tasks.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`}>
                <Card className="h-full transition-all hover:shadow-md hover:border-slate-300 cursor-pointer">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">
                      {project.name}
                    </CardTitle>
                    <CardDescription className="text-xs line-clamp-2">
                      {project.description || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2 space-y-3">
                    {/* Goals Preview */}
                    {project.goals && project.goals.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-1">Goals</p>
                        <div className="flex flex-wrap gap-1">
                          {project.goals.slice(0, 2).map((goal, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs bg-slate-50"
                            >
                              {goal.length > 25 ? `${goal.slice(0, 25)}...` : goal}
                            </Badge>
                          ))}
                          {project.goals.length > 2 && (
                            <Badge variant="outline" className="text-xs bg-slate-50">
                              +{project.goals.length - 2} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Meta Info */}
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>
                        Created {new Date(project.created_at).toLocaleDateString()}
                      </span>
                      {project.github_repo && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                          </svg>
                          GitHub
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
