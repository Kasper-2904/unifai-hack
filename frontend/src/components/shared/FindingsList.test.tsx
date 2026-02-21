import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FindingsList } from "./FindingsList";
import type { RiskSignal } from "@/lib/types";

const findings: RiskSignal[] = [
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
  {
    id: "risk-2",
    project_id: "proj-1",
    task_id: "task-8",
    subtask_id: null,
    source: "ci_failure",
    severity: "high",
    title: "Flaky auth test",
    description: "Test fails intermittently.",
    rationale: "Race condition in token validation.",
    recommended_action: "Mock datetime in tests.",
    is_resolved: true,
    resolved_at: "2025-06-17T10:00:00Z",
    resolved_by_id: "user-2",
    created_at: "2025-06-16T12:00:00Z",
    updated_at: null,
  },
];

describe("FindingsList", () => {
  it("renders finding titles", () => {
    render(<FindingsList findings={findings} />);
    expect(screen.getByText("Schema mismatch in PR normalization")).toBeInTheDocument();
    expect(screen.getByText("Flaky auth test")).toBeInTheDocument();
  });

  it("renders severity badges", () => {
    render(<FindingsList findings={findings} />);
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("renders source badges", () => {
    render(<FindingsList findings={findings} />);
    expect(screen.getByText("Reviewer")).toBeInTheDocument();
    expect(screen.getByText("Ci Failure")).toBeInTheDocument();
  });

  it("shows rationale", () => {
    render(<FindingsList findings={findings} />);
    expect(screen.getByText(/Reviewer detected missing field/)).toBeInTheDocument();
  });

  it("shows recommended action", () => {
    render(<FindingsList findings={findings} />);
    expect(screen.getByText(/Add reviewers field/)).toBeInTheDocument();
  });

  it("shows resolved/open status", () => {
    render(<FindingsList findings={findings} />);
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Resolved")).toBeInTheDocument();
  });

  it("shows empty state for no findings", () => {
    render(<FindingsList findings={[]} />);
    expect(screen.getByText("No findings")).toBeInTheDocument();
  });
});
