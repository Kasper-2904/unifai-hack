import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { RiskIndicator } from '@/components/shared/RiskIndicator'
import { DraftViewer } from '@/components/shared/DraftViewer'
import { ContextPanel } from '@/components/shared/ContextPanel'
import {
  useTask,
  useSubtasks,
  useRiskSignals,
  usePlans,
  useTaskReasoningLogs,
} from '@/hooks/use-api'
import { updateTaskStatus, startTask } from '@/lib/api'
import { TaskStatus, type SubtaskDetail, type TaskReasoningLog } from '@/lib/types'

const statusColors: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  draft_generated: 'bg-blue-100 text-blue-700',
  in_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  finalized: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

function SubtaskCard({ subtask }: { subtask: SubtaskDetail }) {
  const statusClass = statusColors[subtask.status] || 'bg-slate-100 text-slate-700'

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{subtask.title}</span>
              <Badge variant="outline" className={`text-xs ${statusClass}`}>
                {subtask.status.replaceAll('_', ' ')}
              </Badge>
              {subtask.priority && (
                <Badge variant="outline" className="text-xs bg-slate-50">
                  P{subtask.priority}
                </Badge>
              )}
            </div>
            {subtask.description && (
              <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                {subtask.description}
              </p>
            )}
            {subtask.risk_flags && subtask.risk_flags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {subtask.risk_flags.map((flag) => (
                  <span
                    key={flag}
                    className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {flag}
                  </span>
                ))}
              </div>
            )}
          </div>
          {subtask.assignee_id && (
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                {subtask.assignee_id.slice(0, 2).toUpperCase()}
              </div>
            </div>
          )}
        </div>
        {subtask.draft_content && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-1">Draft preview:</p>
            <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded">
              {'Draft available'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getReasoningStatusBadgeClass(status: string): string {
  if (status === 'completed' || status === 'completed_with_errors') {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  }
  if (status === 'failed') {
    return 'bg-red-100 text-red-700 border-red-200'
  }
  if (status === 'in_progress') {
    return 'bg-amber-100 text-amber-700 border-amber-200'
  }
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

function ReasoningLogRow({ log }: { log: TaskReasoningLog }) {
  const statusClass = getReasoningStatusBadgeClass(log.status)
  const isActive = log.status === 'in_progress'

  return (
    <div className="flex gap-3 rounded-md border border-slate-200 bg-white p-3">
      <div className="pt-1">
        <div className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={`text-[11px] ${statusClass}`}>
            {log.status.replaceAll('_', ' ')}
          </Badge>
          <span className="text-xs text-slate-500">{log.event_type}</span>
          <span className="text-xs text-slate-400">#{log.sequence}</span>
          <span className="text-xs text-slate-400">
            {new Date(log.created_at).toLocaleTimeString()}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-700">{log.message}</p>
      </div>
    </div>
  )
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  const { data: task, isLoading: taskLoading } = useTask(id!)
  const { data: subtasks, isLoading: subtasksLoading } = useSubtasks(id!)
  const { data: risks } = useRiskSignals(id)
  const { data: plans } = usePlans(id)
  const {
    logs: reasoningLogs,
    isLoading: reasoningLoading,
    isError: reasoningError,
    streamWarning,
    streamState,
  } = useTaskReasoningLogs(id!)

  // Get project ID from the first plan (if available)
  const projectId = plans && plans.length > 0 ? plans[0].project_id : undefined

  // Status update mutation
  const statusMutation = useMutation({
    mutationFn: ({ status, agentId }: { status: string; agentId?: string }) =>
      updateTaskStatus(id!, status, agentId),
    onSuccess: () => {
      setStatusMessage({ type: 'success', text: 'Task status updated successfully' })
      void queryClient.invalidateQueries({ queryKey: ['task', id] })
      setTimeout(() => setStatusMessage(null), 3000)
    },
    onError: (error: Error) => {
      setStatusMessage({ type: 'error', text: error.message || 'Failed to update status' })
    },
  })

  // Start task mutation
  const startMutation = useMutation({
    mutationFn: (projectId: string) => startTask(id!, projectId),
    onSuccess: (result) => {
      if (result.error) {
        setStatusMessage({ type: 'error', text: result.error })
      } else {
        setStatusMessage({ type: 'success', text: 'Task started and sent to orchestrator' })
      }
      void queryClient.invalidateQueries({ queryKey: ['task', id] })
    },
    onError: (error: Error) => {
      setStatusMessage({ type: 'error', text: error.message || 'Failed to start task' })
    },
  })

  // Get available status transitions based on current status
  const getAvailableTransitions = (currentStatus: string) => {
    const transitions: Record<string, { status: string; label: string; variant: 'default' | 'outline' | 'destructive' }[]> = {
      [TaskStatus.PENDING]: [
        { status: TaskStatus.IN_PROGRESS, label: 'Start', variant: 'default' },
        { status: TaskStatus.CANCELLED, label: 'Cancel', variant: 'destructive' },
      ],
      [TaskStatus.ASSIGNED]: [
        { status: TaskStatus.IN_PROGRESS, label: 'Start', variant: 'default' },
        { status: TaskStatus.CANCELLED, label: 'Cancel', variant: 'destructive' },
      ],
      [TaskStatus.IN_PROGRESS]: [
        { status: TaskStatus.COMPLETED, label: 'Complete', variant: 'default' },
        { status: TaskStatus.FAILED, label: 'Mark Failed', variant: 'outline' },
        { status: TaskStatus.CANCELLED, label: 'Cancel', variant: 'destructive' },
      ],
      [TaskStatus.COMPLETED]: [
        { status: TaskStatus.CANCELLED, label: 'Cancel', variant: 'destructive' },
      ],
      [TaskStatus.FAILED]: [
        { status: TaskStatus.PENDING, label: 'Retry', variant: 'default' },
        { status: TaskStatus.CANCELLED, label: 'Cancel', variant: 'destructive' },
      ],
      [TaskStatus.CANCELLED]: [
        { status: TaskStatus.PENDING, label: 'Reopen', variant: 'default' },
      ],
    }
    return transitions[currentStatus] || []
  }

  if (taskLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-slate-500">Loading task...</div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="rounded-full bg-slate-100 p-3 mb-4">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-slate-600 mb-2">Task not found</p>
        <Link to="/tasks" className="text-sm text-sky-600 hover:underline">
          Back to tasks
        </Link>
      </div>
    )
  }

  const draftSubtask = subtasks?.find((s) => s.draft_content !== null)
  const pendingSubtasks = subtasks?.filter((s) => s.status === 'pending') ?? []
  const inProgressSubtasks = subtasks?.filter((s) => ['draft_generated', 'in_review'].includes(s.status)) ?? []
  const completedSubtasks = subtasks?.filter((s) => ['approved', 'finalized'].includes(s.status)) ?? []

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link to="/projects" className="hover:text-slate-700">Projects</Link>
          <span>/</span>
          <span className="text-slate-900 truncate max-w-[200px]">{task.title}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-slate-900">{task.title}</h1>
              <StatusBadge status={task.status} />
            </div>
            {task.description && (
              <p className="mt-2 text-sm text-slate-600">{task.description}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {task.task_type}
              </span>
              {task.assigned_agent_id && (
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Agent assigned
                </span>
              )}
              {task.created_at && (
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {new Date(task.created_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          {projectId && <ContextPanel projectId={projectId} currentTaskId={task.id} />}
        </div>

        {/* Status Action Buttons */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {getAvailableTransitions(task.status).map((transition) => (
            <Button
              key={transition.status}
              variant={transition.variant}
              size="sm"
              disabled={statusMutation.isPending || startMutation.isPending}
              onClick={() => {
                // For "Start" on pending/assigned tasks with a plan, use startTask to trigger orchestrator
                if (
                  transition.status === TaskStatus.IN_PROGRESS &&
                  (task.status === TaskStatus.PENDING || task.status === TaskStatus.ASSIGNED) &&
                  plans &&
                  plans.length > 0
                ) {
                  const approvedPlan = plans.find((p) => p.status === 'approved')
                  if (approvedPlan) {
                    startMutation.mutate(approvedPlan.project_id)
                    return
                  }
                }
                statusMutation.mutate({ status: transition.status })
              }}
            >
              {transition.label}
            </Button>
          ))}
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`mt-3 rounded-md px-3 py-2 text-sm ${
              statusMessage.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {statusMessage.text}
            <button
              className="ml-2 text-current hover:opacity-70"
              onClick={() => setStatusMessage(null)}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="max-w-md">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-slate-600">Progress</span>
          <span className="font-medium">{Math.round(task.progress * 100)}%</span>
        </div>
        <ProgressBar value={task.progress} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="subtasks" className="space-y-4">
        <TabsList variant="jira">
          <TabsTrigger value="subtasks">
            Subtasks {subtasks ? `(${subtasks.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="draft">
            Draft {draftSubtask ? '' : '(empty)'}
          </TabsTrigger>
          <TabsTrigger value="risks">
            Risks {risks && risks.length > 0 ? `(${risks.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="reasoning">
            Reasoning {reasoningLogs.length > 0 ? `(${reasoningLogs.length})` : ''}
          </TabsTrigger>
        </TabsList>

        {/* Subtasks Tab */}
        <TabsContent value="subtasks" className="space-y-6">
          {subtasksLoading ? (
            <p className="text-sm text-slate-500">Loading subtasks...</p>
          ) : !subtasks || subtasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-slate-100 p-3 mb-4">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-sm text-slate-600 mb-2">No subtasks yet</p>
                <p className="text-xs text-slate-400">Subtasks will appear here once a plan is generated.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Pending Column */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                  <h3 className="text-sm font-medium text-slate-700">Pending</h3>
                  <Badge variant="outline" className="text-xs">{pendingSubtasks.length}</Badge>
                </div>
                <div className="space-y-3">
                  {pendingSubtasks.map((sub) => (
                    <SubtaskCard key={sub.id} subtask={sub} />
                  ))}
                  {pendingSubtasks.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">No pending subtasks</p>
                  )}
                </div>
              </div>

              {/* In Progress Column */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                  <h3 className="text-sm font-medium text-slate-700">In Progress</h3>
                  <Badge variant="outline" className="text-xs">{inProgressSubtasks.length}</Badge>
                </div>
                <div className="space-y-3">
                  {inProgressSubtasks.map((sub) => (
                    <SubtaskCard key={sub.id} subtask={sub} />
                  ))}
                  {inProgressSubtasks.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">No subtasks in progress</p>
                  )}
                </div>
              </div>

              {/* Completed Column */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  <h3 className="text-sm font-medium text-slate-700">Completed</h3>
                  <Badge variant="outline" className="text-xs">{completedSubtasks.length}</Badge>
                </div>
                <div className="space-y-3">
                  {completedSubtasks.map((sub) => (
                    <SubtaskCard key={sub.id} subtask={sub} />
                  ))}
                  {completedSubtasks.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">No completed subtasks</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Task Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Status</span>
                    <div className="mt-1">
                      <StatusBadge status={task.status} />
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Progress</span>
                    <div className="mt-1 font-medium">{Math.round(task.progress * 100)}%</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Task Type</span>
                    <div className="mt-1">{task.task_type}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Agent</span>
                    <div className="mt-1">{task.assigned_agent_id ? 'Assigned' : 'Not assigned'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {plans && plans.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Plan</CardTitle>
                    <Link
                      to="/context"
                      className="text-xs text-sky-600 hover:underline"
                    >
                      View OA Rationale
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {plans.map((plan) => (
                    <div key={plan.id} className="text-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <StatusBadge status={plan.status} />
                        <span className="text-xs text-slate-500">v{plan.version}</span>
                      </div>
                      {typeof plan.plan_data.summary === 'string' && (
                        <p className="text-slate-600">{plan.plan_data.summary}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Draft Tab */}
        <TabsContent value="draft">
          {draftSubtask ? (
            <DraftViewer
              content={draftSubtask.draft_content}
              generatedAt={draftSubtask.draft_generated_at}
              agentId={draftSubtask.draft_agent_id}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-slate-100 p-3 mb-4">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-600 mb-2">No draft yet</p>
                <p className="text-xs text-slate-400">A draft will be generated when an agent works on this task.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Risks Tab */}
        <TabsContent value="risks" className="space-y-3">
          {risks && risks.length > 0 ? (
            risks.map((risk) => (
              <Card key={risk.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <RiskIndicator severity={risk.severity} />
                        <span className="font-medium text-sm">{risk.title}</span>
                        {risk.is_resolved && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                            Resolved
                          </Badge>
                        )}
                      </div>
                      {risk.description && (
                        <p className="mt-2 text-sm text-slate-600">{risk.description}</p>
                      )}
                      {risk.recommended_action && (
                        <div className="mt-3 rounded bg-slate-50 p-3 text-sm">
                          <span className="font-medium text-slate-700">Recommended: </span>
                          <span className="text-slate-600">{risk.recommended_action}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-green-100 p-3 mb-4">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-600 mb-2">No risks detected</p>
                <p className="text-xs text-slate-400">Risk signals will appear here if any are identified.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Reasoning Tab */}
        <TabsContent value="reasoning" className="space-y-3">
          {streamWarning && (
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-amber-700">
                  {streamWarning} Current stream state: {streamState}.
                </p>
              </CardContent>
            </Card>
          )}

          {reasoningLoading ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-500">
                Loading reasoning timeline...
              </CardContent>
            </Card>
          ) : reasoningError ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-red-600">
                Could not load reasoning logs.
              </CardContent>
            </Card>
          ) : reasoningLogs.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-sm text-slate-600">No reasoning logs yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  Logs will appear here when task orchestration starts.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reasoningLogs.map((log) => (
                <ReasoningLogRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
