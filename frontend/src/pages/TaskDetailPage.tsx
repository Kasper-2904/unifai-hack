// TaskDetailPage — full detail view for a single task.
// Shows overview, agent draft, subtasks, and risks in tabs.
// Also has a "View Context" button that opens the big context panel.

import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { RiskIndicator } from "@/components/shared/RiskIndicator";
import { DraftViewer } from "@/components/shared/DraftViewer";
import { ContextPanel } from "@/components/shared/ContextPanel";
import { useTask, useSubtasks, useRiskSignals, usePlans } from "@/hooks/use-api";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: task, isLoading: taskLoading } = useTask(id!);
  const { data: subtasks } = useSubtasks(id!);
  const { data: risks } = useRiskSignals(id);
  const { data: plans } = usePlans(id);

  if (taskLoading) {
    return <div className="text-sm text-slate-500">Loading task...</div>;
  }

  if (task === null || task === undefined) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Task not found</p>
        <Link to="/tasks" className="text-sky-600 hover:underline text-sm mt-2 inline-block">
          Back to tasks
        </Link>
      </div>
    );
  }

  // Get the first subtask with draft content to show in the Draft tab
  const draftSubtask = subtasks?.find((s) => s.draft_content !== null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{task.title}</h2>
            <StatusBadge status={task.status} />
          </div>
          {task.description && (
            <p className="mt-1 text-sm text-slate-600">{task.description}</p>
          )}
          <div className="mt-2 flex gap-4 text-xs text-slate-500">
            {task.assigned_agent_id && (
              <span>Agent: {task.assigned_agent_id}</span>
            )}
            <span>Type: {task.task_type}</span>
            {task.created_at && (
              <span>Created: {new Date(task.created_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        <ContextPanel projectId="proj-1" currentTaskId={task.id} />
      </div>

      {/* Progress */}
      <div className="max-w-md">
        <ProgressBar value={task.progress} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="draft">
            Draft {draftSubtask ? "" : "(empty)"}
          </TabsTrigger>
          <TabsTrigger value="subtasks">
            Subtasks {subtasks ? `(${subtasks.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="risks">
            Risks {risks ? `(${risks.length})` : ""}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Task Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-500">Status</span>
                  <div className="mt-1">
                    <StatusBadge status={task.status} />
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Progress</span>
                  <div className="mt-1">{Math.round(task.progress * 100)}%</div>
                </div>
                <div>
                  <span className="text-slate-500">Assigned Agent</span>
                  <div className="mt-1">{task.assigned_agent_id ?? "Not assigned"}</div>
                </div>
                <div>
                  <span className="text-slate-500">Task Type</span>
                  <div className="mt-1">{task.task_type}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plan Info (if exists) */}
          {plans && plans.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Plan</CardTitle>
                  <Link
                    to="/context"
                    className="text-xs text-sky-600 hover:underline"
                  >
                    View OA Rationale
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                {plans.map((plan) => (
                  <div key={plan.id}>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={plan.status} />
                      <span className="text-xs text-slate-500">v{plan.version}</span>
                    </div>
                    {"summary" in plan.plan_data && (
                      <p className="mt-1 text-slate-600">
                        {String(plan.plan_data.summary)}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Draft Tab */}
        <TabsContent value="draft" className="mt-4">
          {draftSubtask ? (
            <DraftViewer
              content={draftSubtask.draft_content}
              generatedAt={draftSubtask.draft_generated_at}
              agentId={draftSubtask.draft_agent_id}
            />
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
              No draft has been generated for this task yet.
            </div>
          )}
        </TabsContent>

        {/* Subtasks Tab */}
        <TabsContent value="subtasks" className="mt-4 space-y-3">
          {subtasks && subtasks.length > 0 ? (
            subtasks.map((sub) => (
              <Card key={sub.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{sub.title}</span>
                        <StatusBadge status={sub.status} />
                      </div>
                      {sub.description && (
                        <p className="mt-1 text-xs text-slate-500">
                          {sub.description}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      Priority: {sub.priority}
                    </div>
                  </div>
                  {sub.risk_flags.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {sub.risk_flags.map((flag) => (
                        <span
                          key={flag}
                          className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
              No subtasks for this task.
            </div>
          )}
        </TabsContent>

        {/* Risks Tab */}
        <TabsContent value="risks" className="mt-4 space-y-3">
          {risks && risks.length > 0 ? (
            risks.map((risk) => (
              <Card key={risk.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RiskIndicator severity={risk.severity} />
                      <span className="font-medium text-sm">{risk.title}</span>
                    </div>
                    {risk.is_resolved && (
                      <span className="text-xs text-green-600">Resolved</span>
                    )}
                  </div>
                  {risk.description && (
                    <p className="mt-2 text-xs text-slate-600">{risk.description}</p>
                  )}
                  {risk.recommended_action && (
                    <div className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-700">
                      <span className="font-medium">Recommended: </span>
                      {risk.recommended_action}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
              No risk signals for this task.
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Back link */}
      <Link to="/tasks" className="text-sm text-sky-600 hover:underline inline-block">
        Back to all tasks
      </Link>
    </div>
  );
}
