import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TaskDetailPage from "./TaskDetailPage";
import { getTask, getSubtasks, getRiskSignals, getPlans, getProject, getTeamMembers, getTasks } from "@/lib/api";
import type { Task, Plan } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  getTask: vi.fn(),
  getSubtasks: vi.fn(),
  getRiskSignals: vi.fn(),
  getPlans: vi.fn(),
  getProject: vi.fn(),
  getTeamMembers: vi.fn(),
  getTasks: vi.fn(),
}));

const mockTask: Task = {
  id: "task-2",
  title: "Build GitHub ingestion adapter",
  description: "Pull PRs, issues, commits from GitHub API",
  task_type: "feature",
  status: "in_progress",
  progress: 0.4,
  assigned_agent_id: "agent-1",
  team_id: null,
  created_at: "2025-06-11T10:00:00Z",
  started_at: "2025-06-12T08:00:00Z",
  completed_at: null,
};

const mockPlan: Plan = {
  id: "plan-1",
  task_id: "task-2",
  project_id: "proj-1",
  status: "approved",
  plan_data: { summary: "Build GitHub ingestion in 3 subtasks" },
  approved_by_id: "user-2",
  approved_at: "2025-06-12T07:30:00Z",
  rejection_reason: null,
  version: 1,
  created_at: "2025-06-11T16:00:00Z",
  updated_at: null,
};

function renderWithProviders(taskId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/tasks/${taskId}`]}>
        <Routes>
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("TaskDetailPage", () => {
  const mockedGetTask = vi.mocked(getTask);
  const mockedGetSubtasks = vi.mocked(getSubtasks);
  const mockedGetRiskSignals = vi.mocked(getRiskSignals);
  const mockedGetPlans = vi.mocked(getPlans);
  const mockedGetProject = vi.mocked(getProject);
  const mockedGetTeamMembers = vi.mocked(getTeamMembers);
  const mockedGetTasks = vi.mocked(getTasks);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetTask.mockResolvedValue(mockTask);
    mockedGetSubtasks.mockResolvedValue([]);
    mockedGetRiskSignals.mockResolvedValue([]);
    mockedGetPlans.mockResolvedValue([mockPlan]);
    mockedGetProject.mockResolvedValue(null as unknown as undefined);
    mockedGetTeamMembers.mockResolvedValue([]);
    mockedGetTasks.mockResolvedValue([]);
  });

  it("shows loading state initially", () => {
    mockedGetTask.mockImplementation(() => new Promise(() => {}));
    renderWithProviders("task-2");
    expect(screen.getByText("Loading task...")).toBeInTheDocument();
  });

  it("renders task title after loading", async () => {
    renderWithProviders("task-2");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Build GitHub ingestion adapter" })).toBeInTheDocument();
    });
  });

  it("renders tab buttons", async () => {
    renderWithProviders("task-2");
    await waitFor(() => {
      expect(screen.getByText("Overview")).toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: /Draft/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Subtasks/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Risks/ })).toBeInTheDocument();
  });

  it("shows not found for invalid task", async () => {
    mockedGetTask.mockResolvedValue(null);
    renderWithProviders("nonexistent");
    await waitFor(() => {
      expect(screen.getByText("Task not found")).toBeInTheDocument();
    });
  });

  it("renders the View Context button", async () => {
    renderWithProviders("task-2");
    await waitFor(() => {
      expect(screen.getByText("View Context")).toBeInTheDocument();
    });
  });

  it("shows status badge for task", async () => {
    renderWithProviders("task-2");
    await waitFor(() => {
      expect(screen.getAllByText("In Progress").length).toBeGreaterThan(0);
    });
  });
});
