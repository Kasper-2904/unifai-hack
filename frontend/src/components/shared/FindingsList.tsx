// FindingsList — renders a list of risk signals (reviewer findings or other).
// Each item shows severity, title, rationale, and recommended action.

import { Card, CardContent } from "@/components/ui/card";
import { RiskIndicator } from "./RiskIndicator";
import { Badge } from "@/components/ui/badge";
import type { RiskSignal } from "@/lib/types";

interface FindingsListProps {
  findings: RiskSignal[];
}

function formatSource(source: string): string {
  return source
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function FindingsList({ findings }: FindingsListProps) {
  if (findings.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
        No findings
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {findings.map((finding) => (
        <Card key={finding.id}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RiskIndicator severity={finding.severity} />
                <span className="font-medium text-sm">{finding.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-slate-100 text-slate-600 border-transparent text-xs"
                >
                  {formatSource(finding.source)}
                </Badge>
                {finding.is_resolved ? (
                  <span className="text-xs text-green-600">Resolved</span>
                ) : (
                  <span className="text-xs text-amber-600">Open</span>
                )}
              </div>
            </div>

            {finding.description && (
              <p className="mt-2 text-xs text-slate-600">{finding.description}</p>
            )}

            {finding.rationale && (
              <div className="mt-2 rounded bg-violet-50 p-2 text-xs text-violet-700">
                <span className="font-medium">Rationale: </span>
                {finding.rationale}
              </div>
            )}

            {finding.recommended_action && (
              <div className="mt-2 rounded bg-sky-50 p-2 text-xs text-sky-700">
                <span className="font-medium">Recommended: </span>
                {finding.recommended_action}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
