import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TaskListPage from "./TaskListPage";
import { getTasks } from "@/lib/api";
import type { Task } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  getTasks: vi.fn(),
}));

const mockTasks: Task[] = [
  {
    id: "task-1",
    title: "Set up user authentication API",
    description: "Implement JWT auth endpoints and middleware",
    task_type: "feature",
    status: "pending",
    progress: 0,
    assigned_agent_id: null,
    team_id: null,
    created_at: "2025-06-10T10:00:00Z",
    started_at: null,
    completed_at: null,
  },
  {
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
  },
];

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TaskListPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("TaskListPage", () => {
  const mockedGetTasks = vi.mocked(getTasks);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetTasks.mockResolvedValue(mockTasks);
  });

  it("shows loading state initially", () => {
    mockedGetTasks.mockImplementation(() => new Promise(() => {}));
    renderWithProviders();
    expect(screen.getByText("Loading tasks...")).toBeInTheDocument();
  });

  it("renders kanban column headers", async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Tasks")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getAllByText("In Progress").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
  });

  it("renders task cards after loading", async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Set up user authentication API")).toBeInTheDocument();
    });
    expect(screen.getByText("Build GitHub ingestion adapter")).toBeInTheDocument();
  });

  it("shows task descriptions on cards", async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(
        screen.getByText(/Implement JWT auth endpoints/)
      ).toBeInTheDocument();
    });
  });
});
