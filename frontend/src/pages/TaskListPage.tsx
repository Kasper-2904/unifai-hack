// TaskListPage — shows all tasks in a filterable table.
// Click a row to navigate to the task detail page.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { useTasks } from "@/hooks/use-api";
import { TaskStatus } from "@/lib/types";

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: TaskStatus.PENDING, label: "Pending" },
  { value: TaskStatus.ASSIGNED, label: "Assigned" },
  { value: TaskStatus.IN_PROGRESS, label: "In Progress" },
  { value: TaskStatus.COMPLETED, label: "Completed" },
  { value: TaskStatus.FAILED, label: "Failed" },
  { value: TaskStatus.CANCELLED, label: "Cancelled" },
];

export default function TaskListPage() {
  const { data: tasks, isLoading } = useTasks();
  const [statusFilter, setStatusFilter] = useState("all");
  const navigate = useNavigate();

  const filteredTasks =
    statusFilter === "all"
      ? tasks
      : tasks?.filter((t) => t.status === statusFilter);

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading tasks...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tasks</h2>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[140px]">Agent</TableHead>
              <TableHead className="w-[160px]">Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks && filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <TableRow
                  key={task.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => navigate(`/tasks/${task.id}`)}
                >
                  <TableCell>
                    <div>
                      <div className="font-medium">{task.title}</div>
                      {task.description && (
                        <div className="text-xs text-slate-500 mt-0.5 truncate max-w-md">
                          {task.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={task.status} />
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {task.assigned_agent_id ?? "—"}
                  </TableCell>
                  <TableCell>
                    <ProgressBar value={task.progress} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-400 py-8">
                  No tasks found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
