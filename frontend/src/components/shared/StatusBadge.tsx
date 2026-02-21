// StatusBadge — a small colored chip that shows a status value.
// For example, "completed" shows as a green badge, "failed" as red.
// Works for task statuses, subtask statuses, and agent statuses.

import { Badge } from "@/components/ui/badge";

const statusColors: Record<string, string> = {
  // Task statuses
  pending: "bg-slate-100 text-slate-700",
  assigned: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-slate-200 text-slate-500",

  // Subtask statuses
  draft_generated: "bg-violet-100 text-violet-700",
  in_review: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  finalized: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",

  // Agent statuses
  online: "bg-green-100 text-green-700",
  busy: "bg-amber-100 text-amber-700",
  offline: "bg-slate-200 text-slate-500",
  error: "bg-red-100 text-red-700",

  // Plan statuses
  draft: "bg-slate-100 text-slate-700",
  pending_pm_approval: "bg-amber-100 text-amber-700",
  executed: "bg-green-100 text-green-700",
};

// Turns "in_progress" into "In Progress" for display
function formatLabel(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const colorClass = statusColors[status] ?? "bg-slate-100 text-slate-700";
  return (
    <Badge variant="outline" className={`${colorClass} border-transparent text-xs`}>
      {formatLabel(status)}
    </Badge>
  );
}
