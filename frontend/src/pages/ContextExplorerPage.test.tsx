import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ContextExplorerPage from "./ContextExplorerPage";
import { getPlans, getRiskSignals, getReviewerFindings } from "@/lib/api";
import type { Plan, RiskSignal } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  getPlans: vi.fn(),
  getRiskSignals: vi.fn(),
  getReviewerFindings: vi.fn(),
}));

const mockPlans: Plan[] = [
  {
    id: "plan-1",
    task_id: "task-2",
    project_id: "proj-1",
    status: "approved",
    plan_data: {
      summary: "Build GitHub ingestion in 3 subtasks",
      selected_agent: "CodeDrafter",
      selected_agent_reason: "Has code_generation capability and is online.",
      suggested_assignee: "Kasper",
      suggested_assignee_reason: "Has Python skills, at 50% capacity.",
      alternatives_considered: [
        { agent: "Refactorer", reason: "Specializes in refactoring, not new code." },
      ],
    },
    approved_by_id: "user-2",
    approved_at: "2025-06-12T07:30:00Z",
    rejection_reason: null,
    version: 1,
    created_at: "2025-06-11T16:00:00Z",
    updated_at: null,
  },
];

const mockRisks: RiskSignal[] = [
  {
    id: "risk-1",
    project_id: "proj-1",
    task_id: "task-2",
    subtask_id: "sub-2",
    source: "reviewer",
    severity: "medium",
    title: "Schema mismatch in PR normalization",
    description: "Missing reviewers field.",
    rationale: "Reviewer detected missing field in TASK_GRAPH.md.",
    recommended_action: "Add reviewers field to normalize_pr.",
    is_resolved: false,
    resolved_at: null,
    resolved_by_id: null,
    created_at: "2025-06-14T12:00:00Z",
    updated_at: null,
  },
];

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ContextExplorerPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ContextExplorerPage", () => {
  const mockedGetPlans = vi.mocked(getPlans);
  const mockedGetRiskSignals = vi.mocked(getRiskSignals);
  const mockedGetReviewerFindings = vi.mocked(getReviewerFindings);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetPlans.mockResolvedValue(mockPlans);
    mockedGetRiskSignals.mockResolvedValue(mockRisks);
    mockedGetReviewerFindings.mockResolvedValue(mockRisks);
  });

  it("shows loading state initially", () => {
    mockedGetPlans.mockImplementation(() => new Promise(() => {}));
    mockedGetRiskSignals.mockImplementation(() => new Promise(() => {}));
    renderWithProviders();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders the page heading", async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Context Explorer")).toBeInTheDocument();
    });
  });

  it("renders OA Decisions tab", async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /OA Decisions/ })).toBeInTheDocument();
    });
  });

  it("renders Reviewer Findings tab", async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Reviewer Findings/ })).toBeInTheDocument();
    });
  });

  it("shows plan summaries in OA Decisions tab", async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText(/Build GitHub ingestion/)).toBeInTheDocument();
    });
  });
});
