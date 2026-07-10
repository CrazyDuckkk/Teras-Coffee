"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PeriodeKeuangan } from "@/lib/queries/keuangan";

const OPTIONS: { value: PeriodeKeuangan; label: string }[] = [
  { value: "hari-ini", label: "Hari Ini" },
  { value: "7-hari", label: "7 Hari" },
  { value: "30-hari", label: "30 Hari" },
  { value: "semua", label: "Semua" },
];

export function PeriodeFilter({ current }: { current: PeriodeKeuangan }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("periode", value ?? "30-hari");
    router.push(`/keuangan?${params.toString()}`);
  }

  return (
    <Tabs value={current} onValueChange={handleChange}>
      <TabsList>
        {OPTIONS.map((o) => (
          <TabsTrigger key={o.value} value={o.value}>
            {o.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
