// AgentCard — a card showing an AI agent's name, description,
// category, pricing, and verified status.

import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MarketplaceAgent } from "@/lib/types";

interface AgentCardProps {
  agent: MarketplaceAgent;
  showAddButton?: boolean;
  onAddClick?: () => void;
}

export function AgentCard({ agent, showAddButton, onAddClick }: AgentCardProps) {
  const navigate = useNavigate();

  return (
    <Card className="transition hover:shadow-md hover:border-slate-300">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div 
            className="flex-1 cursor-pointer"
            onClick={() => navigate(`/marketplace/${agent.id}`)}
          >
            <h3 className="font-medium text-sm hover:text-sky-600">{agent.name}</h3>
          </div>
          <div className="flex items-center gap-2">
            {agent.is_verified && (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-transparent text-xs">
                Verified
              </Badge>
            )}
            {showAddButton && onAddClick && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={onAddClick}
              >
                Add
              </Button>
            )}
          </div>
        </div>

        <div 
          className="cursor-pointer"
          onClick={() => navigate(`/marketplace/${agent.id}`)}
        >
          {agent.description && (
            <p className="text-xs text-slate-500 line-clamp-2">
              {agent.description}
            </p>
          )}

          {agent.seller_name && (
            <p className="text-xs text-slate-400 mt-1">
              by {agent.seller_name}
            </p>
          )}

          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-transparent text-xs">
              {agent.category.replace("_", " ")}
            </Badge>
            <Badge
              variant="outline"
              className={`border-transparent text-xs ${
                agent.pricing_type === "free"
                  ? "bg-green-50 text-green-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {agent.pricing_type === "free"
                ? "Free"
                : `$${agent.price_per_use?.toFixed(2)}/use`}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
