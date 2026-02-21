// ContextPanel — a slide-over side panel that shows "big context":
// project info, team members, and other tasks in the project.
// Uses shadcn Sheet component (slides in from the right side).

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import { useTeamMembers, useTasks, useProject } from "@/hooks/use-api";

interface ContextPanelProps {
  projectId: string;
  currentTaskId?: string;
}

export function ContextPanel({ projectId, currentTaskId }: ContextPanelProps) {
  const { data: project } = useProject(projectId);
  const { data: members } = useTeamMembers(projectId);
  const { data: allTasks } = useTasks();

  const otherTasks = allTasks?.filter((t) => t.id !== currentTaskId) ?? [];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          View Context
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] overflow-y-auto sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Project Context</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Project Info */}
          {project && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{project.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <p>{project.description}</p>
                {project.goals.length > 0 && (
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    {project.goals.map((goal, i) => (
                      <li key={i}>{goal}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {/* Team Members */}
          {members && members.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Team Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{m.user_id}</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={m.role} />
                        <span className="text-xs text-slate-500">
                          {Math.round(m.current_load * 100)}% load
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Other Tasks */}
          {otherTasks.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Other Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {otherTasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="truncate mr-2">{t.title}</span>
                      <StatusBadge status={t.status} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
