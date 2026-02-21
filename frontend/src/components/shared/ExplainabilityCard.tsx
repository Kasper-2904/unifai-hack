// ExplainabilityCard — expandable card showing OA decision reasoning.
// Displays why a specific agent was selected, who was suggested as assignee,
// and what alternatives were considered.

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import type { Plan } from "@/lib/types";

interface ExplainabilityCardProps {
  plan: Plan;
}

export function ExplainabilityCard({ plan }: ExplainabilityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const data = plan.plan_data;

  const summary = data.summary as string | undefined;
  const selectedAgent = data.selected_agent as string | undefined;
  const selectedAgentReason = data.selected_agent_reason as string | undefined;
  const suggestedAssignee = data.suggested_assignee as string | undefined;
  const suggestedAssigneeReason = data.suggested_assignee_reason as string | undefined;
  const alternatives = data.alternatives_considered as
    | { agent: string; reason: string }[]
    | undefined;

  return (
    <Card>
      <CardContent className="py-4">
        {/* Header — click to expand */}
        <button
          type="button"
          className="w-full text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {summary ?? `Plan for ${plan.task_id}`}
              </span>
              <StatusBadge status={plan.status} />
            </div>
            <span className="text-xs text-slate-400">
              {expanded ? "collapse" : "expand"}
            </span>
          </div>
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-4 space-y-3 border-t pt-3">
            {/* Selected Agent */}
            {selectedAgent && (
              <div>
                <div className="text-xs font-medium text-slate-500">Selected Agent</div>
                <div className="mt-1 text-sm">{selectedAgent}</div>
                {selectedAgentReason && (
                  <div className="mt-1 rounded bg-sky-50 p-2 text-xs text-sky-700">
                    {selectedAgentReason}
                  </div>
                )}
              </div>
            )}

            {/* Suggested Assignee */}
            {suggestedAssignee && (
              <div>
                <div className="text-xs font-medium text-slate-500">
                  Suggested Assignee
                </div>
                <div className="mt-1 text-sm">{suggestedAssignee}</div>
                {suggestedAssigneeReason && (
                  <div className="mt-1 rounded bg-sky-50 p-2 text-xs text-sky-700">
                    {suggestedAssigneeReason}
                  </div>
                )}
              </div>
            )}

            {/* Alternatives Considered */}
            {alternatives && alternatives.length > 0 && (
              <div>
                <div className="text-xs font-medium text-slate-500">
                  Alternatives Considered
                </div>
                <div className="mt-1 space-y-1">
                  {alternatives.map((alt, i) => (
                    <div
                      key={i}
                      className="rounded bg-slate-50 p-2 text-xs text-slate-600"
                    >
                      <span className="font-medium">{alt.agent}:</span> {alt.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-slate-400">
              v{plan.version} — {new Date(plan.created_at).toLocaleDateString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
