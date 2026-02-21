import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RiskIndicator } from "./RiskIndicator";

describe("RiskIndicator", () => {
  it("renders Low for low severity", () => {
    render(<RiskIndicator severity="low" />);
    expect(screen.getByText("Low")).toBeInTheDocument();
  });

  it("renders Medium for medium severity", () => {
    render(<RiskIndicator severity="medium" />);
    expect(screen.getByText("Medium")).toBeInTheDocument();
  });

  it("renders High for high severity", () => {
    render(<RiskIndicator severity="high" />);
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("renders Critical for critical severity", () => {
    render(<RiskIndicator severity="critical" />);
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("applies blue color for low severity", () => {
    const { container } = render(<RiskIndicator severity="low" />);
    const badge = container.querySelector("[class*='bg-blue']");
    expect(badge).toBeInTheDocument();
  });

  it("applies red color for critical severity", () => {
    const { container } = render(<RiskIndicator severity="critical" />);
    const badge = container.querySelector("[class*='bg-red']");
    expect(badge).toBeInTheDocument();
  });

  it("falls back to low for unknown severity", () => {
    render(<RiskIndicator severity="unknown" />);
    expect(screen.getByText("Low")).toBeInTheDocument();
  });
});
