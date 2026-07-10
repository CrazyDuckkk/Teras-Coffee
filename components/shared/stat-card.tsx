import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "success" | "danger";
}) {
  return (
    <Card className="rounded-xl border-[#E2E8F0] shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
      <CardContent className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span
            className={cn(
              "font-stat text-2xl font-semibold tabular-nums",
              tone === "success" && "text-success-foreground",
              tone === "danger" && "text-danger-foreground"
            )}
          >
            {value}
          </span>
        </div>
        {Icon && (
          <div className="rounded-full bg-accent p-2.5 text-accent-foreground">
            <Icon className="size-5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
