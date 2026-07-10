"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MenuFormDialog } from "./menu-form-dialog";
import type { listBahanBaku } from "@/lib/queries/inventaris";

type BahanBaku = Awaited<ReturnType<typeof listBahanBaku>>[number];

export function MenuActions({ bahanBaku }: { bahanBaku: BahanBaku[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Menu Baru
      </Button>
      <MenuFormDialog mode="create" open={open} onOpenChange={setOpen} bahanBaku={bahanBaku} />
    </>
  );
}
