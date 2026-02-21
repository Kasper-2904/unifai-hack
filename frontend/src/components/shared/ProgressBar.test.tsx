import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("shows percentage text", () => {
    render(<ProgressBar value={0.6} />);
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("shows 0% for zero value", () => {
    render(<ProgressBar value={0} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("shows 100% for full value", () => {
    render(<ProgressBar value={1} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("clamps values above 1 to 100%", () => {
    render(<ProgressBar value={1.5} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("clamps negative values to 0%", () => {
    render(<ProgressBar value={-0.5} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
