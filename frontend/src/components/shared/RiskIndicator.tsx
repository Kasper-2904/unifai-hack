// RiskIndicator — shows a risk severity as a colored label.
// low = blue, medium = yellow, high = orange, critical = red.

import { Badge } from "@/components/ui/badge";

const severityConfig: Record<string, { color: string; label: string }> = {
  low: { color: "bg-blue-100 text-blue-700", label: "Low" },
  medium: { color: "bg-amber-100 text-amber-700", label: "Medium" },
  high: { color: "bg-orange-100 text-orange-700", label: "High" },
  critical: { color: "bg-red-100 text-red-700", label: "Critical" },
};

interface RiskIndicatorProps {
  severity: string;
}

export function RiskIndicator({ severity }: RiskIndicatorProps) {
  const config = severityConfig[severity] ?? severityConfig.low;
  return (
    <Badge variant="outline" className={`${config.color} border-transparent text-xs`}>
      {config.label}
    </Badge>
  );
}
