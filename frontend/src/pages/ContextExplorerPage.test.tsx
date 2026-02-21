import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ContextExplorerPage from "./ContextExplorerPage";

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
  it("shows loading state initially", () => {
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
