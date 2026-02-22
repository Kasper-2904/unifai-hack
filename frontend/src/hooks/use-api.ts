// React Query hooks — each hook fetches data from the real API
// and caches it so components don't re-fetch on every render.
//
// How it works:
// - useQuery takes a "key" (like a cache label) and a function to fetch data
// - It returns { data, isLoading, error } that components can use

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAgent,
  getAgents,
  getMarketplaceAgent,
  getMarketplaceCatalog,
  getPlans,
  getProject,
  getTaskReasoningLogs,
  getReviewerFindings,
  getRiskSignals,
  getSubtasks,
  getTask,
  getTasks,
  subscribeTaskReasoningLogs,
  getTeamMembers,
  publishAgent,
} from "@/lib/api";
import type { TaskReasoningLog, TaskReasoningLogStreamEvent } from "@/lib/types";

export function useTasks() {
  return useQuery({ queryKey: ["tasks"], queryFn: getTasks });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => getTask(id),
    enabled: !!id,
  });
}

function sortReasoningLogs(logs: TaskReasoningLog[]): TaskReasoningLog[] {
  return [...logs].sort((a, b) => {
    if (a.sequence !== b.sequence) {
      return a.sequence - b.sequence;
    }
    if (a.created_at !== b.created_at) {
      return a.created_at.localeCompare(b.created_at);
    }
    return a.id.localeCompare(b.id);
  });
}

function upsertReasoningLog(
  existing: TaskReasoningLog[],
  incoming: TaskReasoningLog,
): TaskReasoningLog[] {
  const byId = new Map(existing.map((log) => [log.id, log]));
  byId.set(incoming.id, incoming);
  return sortReasoningLogs(Array.from(byId.values()));
}

export function useTaskReasoningLogs(taskId: string) {
  const [liveLogs, setLiveLogs] = useState<TaskReasoningLog[]>([]);
  const [streamState, setStreamState] = useState<"connecting" | "connected" | "disconnected">(
    "connecting",
  );
  const [streamWarning, setStreamWarning] = useState<string | null>(null);

  const historyQuery = useQuery({
    queryKey: ["taskReasoningLogs", taskId],
    queryFn: () => getTaskReasoningLogs(taskId),
    enabled: Boolean(taskId),
  });
  const historyLogs = useMemo(
    () => sortReasoningLogs(historyQuery.data ?? []),
    [historyQuery.data],
  );

  useEffect(() => {
    if (!taskId) {
      return;
    }

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopStream: (() => void) | null = null;
    let attempts = 0;
    let isDisposed = false;

    const connect = () => {
      if (isDisposed) return;
      setStreamState("connecting");

      stopStream = subscribeTaskReasoningLogs(taskId, {
        onOpen: () => {
          attempts = 0;
          setStreamState("connected");
          setStreamWarning(null);
        },
        onEvent: (event: TaskReasoningLogStreamEvent) => {
          if (!event.log) return;
          setLiveLogs((previous) => upsertReasoningLog(previous, event.log));
        },
        onError: () => {
          if (isDisposed) return;
          setStreamState("disconnected");
          setStreamWarning("Live updates disconnected. Reconnecting...");
          attempts += 1;
          const retryDelayMs = Math.min(1000 * 2 ** Math.min(attempts, 4), 15000);
          reconnectTimer = setTimeout(connect, retryDelayMs);
        },
      });
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stopStream?.();
    };
  }, [taskId]);

  const mergedLogs = useMemo(() => {
    const byId = new Map<string, TaskReasoningLog>();
    for (const log of historyLogs) {
      byId.set(log.id, log);
    }
    for (const log of liveLogs) {
      byId.set(log.id, log);
    }
    return sortReasoningLogs(Array.from(byId.values()));
  }, [historyLogs, liveLogs]);

  return {
    logs: mergedLogs,
    isLoading: historyQuery.isLoading,
    isError: historyQuery.isError,
    error: historyQuery.error,
    streamState,
    streamWarning,
  };
}

export function useSubtasks(taskId: string) {
  return useQuery({
    queryKey: ["subtasks", taskId],
    queryFn: () => getSubtasks(taskId),
    enabled: !!taskId,
  });
}

export function useRiskSignals(taskId?: string) {
  return useQuery({
    queryKey: ["risks", taskId],
    queryFn: () => getRiskSignals(taskId),
  });
}

export function usePlans(taskId?: string) {
  return useQuery({
    queryKey: ["plans", taskId],
    queryFn: () => getPlans(taskId),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      if (!id) return null;
      const result = await getProject(id);
      return result ?? null;  // Ensure we never return undefined
    },
    enabled: !!id,
  });
}

export function useTeamMembers(projectId: string) {
  return useQuery({
    queryKey: ["teamMembers", projectId],
    queryFn: () => getTeamMembers(projectId),
    enabled: !!projectId,
  });
}

export function useAgents() {
  return useQuery({ queryKey: ["agents"], queryFn: getAgents });
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: ["agent", id],
    queryFn: () => getAgent(id),
    enabled: !!id,
  });
}

export function useMarketplaceCatalog(category?: string) {
  return useQuery({
    queryKey: ["marketplace", category],
    queryFn: () => getMarketplaceCatalog(category),
  });
}

export function useMarketplaceAgent(id: string) {
  return useQuery({
    queryKey: ["marketplaceAgent", id],
    queryFn: () => getMarketplaceAgent(id),
    enabled: !!id,
  });
}

export function useReviewerFindings(projectId: string) {
  return useQuery({
    queryKey: ["reviewerFindings", projectId],
    queryFn: () => getReviewerFindings(projectId),
    enabled: !!projectId,
  });
}

export function usePublishAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: publishAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace"] });
    },
  });
}
