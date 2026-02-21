import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplainabilityCard } from "./ExplainabilityCard";
import type { Plan } from "@/lib/types";

const mockPlan: Plan = {
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
};

describe("ExplainabilityCard", () => {
  it("renders the plan summary", () => {
    render(<ExplainabilityCard plan={mockPlan} />);
    expect(screen.getByText("Build GitHub ingestion in 3 subtasks")).toBeInTheDocument();
  });

  it("renders the status badge", () => {
    render(<ExplainabilityCard plan={mockPlan} />);
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("does not show details by default", () => {
    render(<ExplainabilityCard plan={mockPlan} />);
    expect(screen.queryByText("CodeDrafter")).not.toBeInTheDocument();
  });

  it("expands to show agent reasoning when clicked", async () => {
    render(<ExplainabilityCard plan={mockPlan} />);
    await userEvent.click(screen.getByText("expand"));
    expect(screen.getByText("CodeDrafter")).toBeInTheDocument();
    expect(screen.getByText("Has code_generation capability and is online.")).toBeInTheDocument();
  });

  it("shows suggested assignee when expanded", async () => {
    render(<ExplainabilityCard plan={mockPlan} />);
    await userEvent.click(screen.getByText("expand"));
    expect(screen.getByText("Kasper")).toBeInTheDocument();
    expect(screen.getByText("Has Python skills, at 50% capacity.")).toBeInTheDocument();
  });

  it("shows alternatives when expanded", async () => {
    render(<ExplainabilityCard plan={mockPlan} />);
    await userEvent.click(screen.getByText("expand"));
    expect(screen.getByText(/Refactorer/)).toBeInTheDocument();
    expect(screen.getByText(/Specializes in refactoring/)).toBeInTheDocument();
  });

  it("collapses when clicked again", async () => {
    render(<ExplainabilityCard plan={mockPlan} />);
    await userEvent.click(screen.getByText("expand"));
    expect(screen.getByText("CodeDrafter")).toBeInTheDocument();
    await userEvent.click(screen.getByText("collapse"));
    expect(screen.queryByText("CodeDrafter")).not.toBeInTheDocument();
  });
});
