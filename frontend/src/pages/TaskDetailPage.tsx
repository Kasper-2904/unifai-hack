import { useRef, useState } from 'react'
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
import { TaskActivityFeed } from '@/components/shared/TaskActivityFeed'
import {
  useTask,
  useSubtasks,
  useRiskSignals,
  usePlans,
  useTaskReasoningLogs,
  useTaskLogs,
} from '@/hooks/use-api'
import { updateTaskStatus, startTask } from '@/lib/api'
import { approvePlan, generatePlan, rejectPlan } from '@/lib/pmApi'
import { PlanStatus, TaskStatus, type SubtaskDetail, type TaskReasoningLog } from '@/lib/types'

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
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [activeTab, setActiveTab] = useState('activity')
  const tabsRef = useRef<HTMLDivElement>(null)

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

  // Get project ID: prefer plan's project_id, fallback to task.team_id (which stores project_id)
  const projectId = (plans && plans.length > 0 ? plans[0].project_id : undefined) ?? task?.team_id ?? undefined

  // Find the pending plan (if any) for the plan review card
  const pendingPlan = plans?.find((p) => p.status === PlanStatus.PENDING_PM_APPROVAL)
  const approvedPlan = plans?.find((p) => p.status === PlanStatus.APPROVED)

  // Task activity logs with polling
  const { logs: taskLogs, isPolling } = useTaskLogs(id, task?.status)

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['task', id] })
    void queryClient.invalidateQueries({ queryKey: ['plans', id] })
    void queryClient.invalidateQueries({ queryKey: ['subtasks', id] })
  }

  // Status update mutation
  const statusMutation = useMutation({
    mutationFn: ({ status, agentId }: { status: string; agentId?: string }) =>
      updateTaskStatus(id!, status, agentId),
    onSuccess: () => {
      setStatusMessage({ type: 'success', text: 'Task status updated successfully' })
      invalidateAll()
      setTimeout(() => setStatusMessage(null), 3000)
    },
    onError: (error: Error) => {
      setStatusMessage({ type: 'error', text: error.message || 'Failed to update status' })
    },
  })

  // Generate plan mutation (Step 1: orchestrator generates the plan)
  const generatePlanMutation = useMutation({
    mutationFn: (projId: string) => generatePlan(id!, projId),
    onSuccess: (result) => {
      if (result.error) {
        setStatusMessage({ type: 'error', text: result.error })
      } else {
        setStatusMessage({ type: 'success', text: 'Plan generated — review and approve below' })
      }
      invalidateAll()
    },
    onError: (error: Error) => {
      setStatusMessage({ type: 'error', text: error.message || 'Failed to generate plan' })
    },
  })

  // Approve plan mutation (Step 2: triggers orchestrator to execute the plan in background)
  const approvePlanMutation = useMutation({
    mutationFn: (planId: string) => approvePlan(planId),
    onSuccess: () => {
      setStatusMessage({ type: 'success', text: 'Plan approved — orchestrator is executing the task' })
      setActiveTab('reasoning')
      invalidateAll()
      // Scroll tabs into view so the user sees the Reasoning tab immediately
      setTimeout(() => {
        tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    },
    onError: (error: Error) => {
      setStatusMessage({ type: 'error', text: error.message || 'Failed to approve plan' })
    },
  })

  // Reject plan mutation
  const rejectPlanMutation = useMutation({
    mutationFn: ({ planId, reason }: { planId: string; reason: string }) => rejectPlan(planId, reason),
    onSuccess: () => {
      setStatusMessage({ type: 'success', text: 'Plan rejected' })
      setShowRejectInput(false)
      setRejectReason('')
      invalidateAll()
    },
    onError: (error: Error) => {
      setStatusMessage({ type: 'error', text: error.message || 'Failed to reject plan' })
    },
  })

  // Start task mutation (used when plan is already approved)
  const startMutation = useMutation({
    mutationFn: (projId: string) => startTask(id!, projId),
    onSuccess: (result) => {
      if (result.error) {
        setStatusMessage({ type: 'error', text: result.error })
      } else {
        setStatusMessage({ type: 'success', text: 'Task started and sent to orchestrator' })
      }
      invalidateAll()
    },
    onError: (error: Error) => {
      setStatusMessage({ type: 'error', text: error.message || 'Failed to start task' })
    },
  })

  const isBusy = statusMutation.isPending || startMutation.isPending || generatePlanMutation.isPending || approvePlanMutation.isPending || rejectPlanMutation.isPending

  // Get available status transitions based on current status
  // pending: Start button visible (generates plan, moves to assigned)
  // assigned: no Start button — plan card handles approve/reject
  const getAvailableTransitions = (currentStatus: string) => {
    const base: Record<string, { status: string; label: string; variant: 'default' | 'outline' | 'destructive' }[]> = {
      [TaskStatus.PENDING]: [
        { status: TaskStatus.IN_PROGRESS as string, label: 'Start', variant: 'default' as const },
        { status: TaskStatus.CANCELLED, label: 'Cancel', variant: 'destructive' },
      ],
      [TaskStatus.ASSIGNED]: [
        // Plan review card handles approve/reject — only show Cancel here
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
    return base[currentStatus] || []
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
              disabled={isBusy}
              onClick={() => {
                // "Start" on pending/assigned: generate a plan (or use existing approved plan)
                if (
                  transition.status === TaskStatus.IN_PROGRESS &&
                  (task.status === TaskStatus.PENDING || task.status === TaskStatus.ASSIGNED)
                ) {
                  // If plan already approved (edge case: approval succeeded but task stayed pending),
                  // re-trigger execution via the start endpoint as a recovery mechanism
                  if (approvedPlan) {
                    startMutation.mutate(approvedPlan.project_id)
                    return
                  }
                  // Otherwise generate a new plan for PM review
                  if (projectId) {
                    generatePlanMutation.mutate(projectId)
                  } else {
                    setStatusMessage({ type: 'error', text: 'No project associated with this task' })
                  }
                  return
                }
                statusMutation.mutate({ status: transition.status })
              }}
            >
              {generatePlanMutation.isPending && transition.status === TaskStatus.IN_PROGRESS
                ? 'Generating plan...'
                : transition.label}
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

      {/* Plan Review Card — shown when a plan is waiting for PM approval */}
      {pendingPlan && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <CardTitle className="text-base text-amber-900">Plan Awaiting Approval</CardTitle>
              </div>
              <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                Pending Review
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            {pendingPlan.plan_data.summary ? (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-1">Summary</h4>
                <p className="text-sm text-slate-600">{String(pendingPlan.plan_data.summary)}</p>
              </div>
            ) : null}

            {/* Agent Selection + Human Assignment */}
            <div className="grid gap-3 md:grid-cols-2">
              {pendingPlan.plan_data.selected_agent ? (
                <div className="rounded-md bg-white border border-slate-200 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <h4 className="text-sm font-medium text-slate-700">Selected Agent</h4>
                  </div>
                  <p className="text-sm font-medium text-slate-900">{String(pendingPlan.plan_data.selected_agent)}</p>
                  {pendingPlan.plan_data.selected_agent_reason ? (
                    <p className="mt-1 text-xs text-slate-500">{String(pendingPlan.plan_data.selected_agent_reason)}</p>
                  ) : null}
                </div>
              ) : null}
              {pendingPlan.plan_data.suggested_assignee ? (
                <div className="rounded-md bg-white border border-slate-200 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <h4 className="text-sm font-medium text-slate-700">Suggested Assignee</h4>
                  </div>
                  <p className="text-sm font-medium text-slate-900">{String(pendingPlan.plan_data.suggested_assignee)}</p>
                  {pendingPlan.plan_data.suggested_assignee_reason ? (
                    <p className="mt-1 text-xs text-slate-500">{String(pendingPlan.plan_data.suggested_assignee_reason)}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Subtasks / Steps */}
            {Array.isArray(pendingPlan.plan_data.subtasks) && (pendingPlan.plan_data.subtasks as Array<Record<string, unknown>>).length > 0 ? (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">Planned Subtasks</h4>
                <ol className="space-y-2">
                  {(pendingPlan.plan_data.subtasks as Array<Record<string, unknown>>).map((step, i) => (
                    <li key={i} className="flex gap-3 rounded-md bg-white border border-slate-200 p-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-slate-700">{String(step.title ?? step.description ?? step.name ?? JSON.stringify(step))}</span>
                        {step.skill ? (
                          <Badge variant="outline" className="ml-2 text-[10px]">{String(step.skill)}</Badge>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {/* Alternatives Considered */}
            {Array.isArray(pendingPlan.plan_data.alternatives_considered) && (pendingPlan.plan_data.alternatives_considered as Array<Record<string, unknown>>).length > 0 ? (
              <div>
                <h4 className="text-xs font-medium text-slate-500 mb-1">Alternatives Considered</h4>
                <div className="space-y-1">
                  {(pendingPlan.plan_data.alternatives_considered as Array<Record<string, unknown>>).map((alt, i) => (
                    <p key={i} className="text-xs text-slate-500">
                      <span className="font-medium">{String(alt.agent ?? 'Unknown')}</span>: {String(alt.reason ?? '')}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Estimated Hours */}
            {pendingPlan.plan_data.estimated_hours ? (
              <p className="text-xs text-slate-500">Estimated: {String(pendingPlan.plan_data.estimated_hours)} hours</p>
            ) : null}

            {/* Approve / Reject Actions */}
            <div className="flex items-center gap-3 pt-2 border-t border-amber-200">
              <Button
                size="sm"
                disabled={isBusy}
                onClick={() => approvePlanMutation.mutate(pendingPlan.id)}
              >
                {approvePlanMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Approving & Executing...
                  </span>
                ) : (
                  <>Approve Plan</>
                )}
              </Button>
              {!showRejectInput ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => setShowRejectInput(true)}
                >
                  Reject
                </Button>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    placeholder="Rejection reason..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    disabled={isBusy}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isBusy || !rejectReason.trim()}
                    onClick={() => rejectPlanMutation.mutate({ planId: pendingPlan.id, reason: rejectReason.trim() })}
                  >
                    Confirm Reject
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowRejectInput(false); setRejectReason('') }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generating Plan Loading State */}
      {generatePlanMutation.isPending && !pendingPlan && (
        <Card className="border-sky-300 bg-sky-50/50">
          <CardContent className="flex items-center gap-3 py-4">
            <svg className="w-5 h-5 text-sky-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-sky-900">Generating plan...</p>
              <p className="text-xs text-sky-700">The orchestrator is analyzing the task and creating an execution plan. This may take a moment.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Bar */}
      <div className="max-w-md">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-slate-600">Progress</span>
          <span className="font-medium">{Math.round(task.progress * 100)}%</span>
        </div>
        <ProgressBar value={task.progress} />
      </div>

      {/* Tabs */}
      <div ref={tabsRef} />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList variant="jira">
          <TabsTrigger value="activity">
            Activity {isPolling && <span className="ml-1 w-2 h-2 bg-green-500 rounded-full inline-block animate-pulse" />}
          </TabsTrigger>
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

        {/* Activity Tab */}
        <TabsContent value="activity">
          <TaskActivityFeed logs={taskLogs} isPolling={isPolling} maxHeight="500px" />
        </TabsContent>

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
                      {('result' in plan.plan_data || 'summary' in plan.plan_data) && (
                        <p className="text-slate-600 line-clamp-4 whitespace-pre-wrap">
                          {String(plan.plan_data.result ?? plan.plan_data.summary ?? '')}
                        </p>
                      )}
                      {plan.rejection_reason && (
                        <p className="mt-2 text-xs text-red-600">
                          Rejected: {plan.rejection_reason}
                        </p>
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
