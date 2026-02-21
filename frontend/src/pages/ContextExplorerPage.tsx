// ContextExplorerPage — explainability view showing OA decisions
// and reviewer findings. Two tabs: OA Decisions and Reviewer Findings.

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExplainabilityCard } from "@/components/shared/ExplainabilityCard";
import { FindingsList } from "@/components/shared/FindingsList";
import { usePlans, useRiskSignals } from "@/hooks/use-api";

export default function ContextExplorerPage() {
  const { data: plans, isLoading: plansLoading } = usePlans();
  const { data: risks, isLoading: risksLoading } = useRiskSignals();

  const isLoading = plansLoading || risksLoading;

  // Split risks by source
  const reviewerFindings = risks?.filter((r) => r.source === "reviewer") ?? [];
  const otherSignals = risks?.filter((r) => r.source !== "reviewer") ?? [];

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Context Explorer</h2>
        <p className="text-sm text-slate-500 mt-1">
          Understand why the AI made its decisions
        </p>
      </div>

      <Tabs defaultValue="oa-decisions">
        <TabsList>
          <TabsTrigger value="oa-decisions">
            OA Decisions {plans ? `(${plans.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="reviewer-findings">
            Reviewer Findings {reviewerFindings ? `(${reviewerFindings.length})` : ""}
          </TabsTrigger>
        </TabsList>

        {/* OA Decisions Tab */}
        <TabsContent value="oa-decisions" className="mt-4 space-y-3">
          <p className="text-sm text-slate-500">
            Each card shows the orchestrator's reasoning — which agent it picked, why,
            and what alternatives it considered.
          </p>
          {plans && plans.length > 0 ? (
            plans.map((plan) => (
              <ExplainabilityCard key={plan.id} plan={plan} />
            ))
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
              No OA decisions yet
            </div>
          )}
        </TabsContent>

        {/* Reviewer Findings Tab */}
        <TabsContent value="reviewer-findings" className="mt-4 space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-3">Reviewer Agent Findings</h3>
            <FindingsList findings={reviewerFindings} />
          </div>

          {otherSignals.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">Other Risk Signals</h3>
              <FindingsList findings={otherSignals} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
