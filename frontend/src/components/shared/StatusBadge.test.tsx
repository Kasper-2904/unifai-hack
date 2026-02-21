import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the formatted status label", () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("renders completed status", () => {
    render(<StatusBadge status="completed" />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("renders pending status", () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("renders draft_generated as Draft Generated", () => {
    render(<StatusBadge status="draft_generated" />);
    expect(screen.getByText("Draft Generated")).toBeInTheDocument();
  });

  it("renders unknown status without crashing", () => {
    render(<StatusBadge status="something_new" />);
    expect(screen.getByText("Something New")).toBeInTheDocument();
  });

  it("applies green color class for completed", () => {
    const { container } = render(<StatusBadge status="completed" />);
    const badge = container.querySelector("[class*='bg-green']");
    expect(badge).toBeInTheDocument();
  });

  it("applies red color class for failed", () => {
    const { container } = render(<StatusBadge status="failed" />);
    const badge = container.querySelector("[class*='bg-red']");
    expect(badge).toBeInTheDocument();
  });
});
