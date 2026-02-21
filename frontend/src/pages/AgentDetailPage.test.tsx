import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AgentDetailPage from "./AgentDetailPage";
import { getMarketplaceAgent } from "@/lib/api";
import type { MarketplaceAgent } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  getMarketplaceAgent: vi.fn(),
}));

const mockAgent: MarketplaceAgent = {
  id: "mp-1",
  agent_id: "agent-1",
  seller_id: "user-1",
  seller_name: null,
  name: "CodeDrafter",
  category: "code_generation",
  description: "Generates production-ready code.",
  pricing_type: "usage_based",
  price_per_use: 0.1,
  is_verified: true,
  is_active: true,
};

function renderWithProviders(agentId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/marketplace/${agentId}`]}>
        <Routes>
          <Route path="/marketplace/:agentId" element={<AgentDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AgentDetailPage", () => {
  const mockedGetAgent = vi.mocked(getMarketplaceAgent);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAgent.mockResolvedValue(mockAgent);
  });

  it("shows loading state initially", () => {
    mockedGetAgent.mockImplementation(() => new Promise(() => {}));
    renderWithProviders("mp-1");
    expect(screen.getByText("Loading agent...")).toBeInTheDocument();
  });

  it("renders agent name after loading", async () => {
    renderWithProviders("mp-1");
    await waitFor(() => {
      expect(screen.getByText("CodeDrafter")).toBeInTheDocument();
    });
  });

  it("shows verified badge for verified agent", async () => {
    renderWithProviders("mp-1");
    await waitFor(() => {
      expect(screen.getByText("Verified")).toBeInTheDocument();
    });
  });

  it("shows not found for invalid agent", async () => {
    mockedGetAgent.mockResolvedValue(null);
    renderWithProviders("nonexistent");
    await waitFor(() => {
      expect(screen.getByText("Agent not found")).toBeInTheDocument();
    });
  });

  it("shows back to marketplace link", async () => {
    renderWithProviders("mp-1");
    await waitFor(() => {
      expect(screen.getByText("Back to marketplace")).toBeInTheDocument();
    });
  });
});
