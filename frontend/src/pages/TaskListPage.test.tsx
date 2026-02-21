import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TaskListPage from "./TaskListPage";

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
  it("shows loading state initially", () => {
    renderWithProviders();
    expect(screen.getByText("Loading tasks...")).toBeInTheDocument();
  });

  it("renders task rows after loading", async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Set up user authentication API")).toBeInTheDocument();
    });
    expect(screen.getByText("Build GitHub ingestion adapter")).toBeInTheDocument();
  });

  it("renders the Tasks heading", async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Tasks")).toBeInTheDocument();
    });
  });

  it("renders status badges for tasks", async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("Completed")).toBeInTheDocument();
    });
    // Multiple tasks may have "In Progress" status, so use getAllByText
    expect(screen.getAllByText("In Progress").length).toBeGreaterThan(0);
  });

  it("renders the status filter dropdown", async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText("All Statuses")).toBeInTheDocument();
    });
  });
});
