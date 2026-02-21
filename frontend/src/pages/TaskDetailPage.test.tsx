import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TaskDetailPage from "./TaskDetailPage";

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
  it("shows loading state initially", () => {
    renderWithProviders("task-2");
    expect(screen.getByText("Loading task...")).toBeInTheDocument();
  });

  it("renders task title after loading", async () => {
    renderWithProviders("task-2");
    await waitFor(() => {
      expect(screen.getByText("Build GitHub ingestion adapter")).toBeInTheDocument();
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
    // The status badge appears in the header and in the overview tab
    await waitFor(() => {
      expect(screen.getAllByText("In Progress").length).toBeGreaterThan(0);
    });
  });
});
