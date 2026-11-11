"use client";

import { useState } from "react";
import { Coffee, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NavList } from "./nav-list";
import { UserMenu } from "./user-menu";
import type { UserRole } from "@/lib/roles";

export function MobileNav({ role }: { role: UserRole }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:hidden">
      <div className="flex items-center gap-2">
        <Coffee className="size-5 text-primary" />
        <span className="font-semibold">Teras Coffee</span>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Buka menu" />}>
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-65 p-0">
          <SheetHeader className="h-16 justify-center border-b border-border">
            <SheetTitle className="flex items-center gap-2 text-left">
              <Coffee className="size-5 text-primary" />
              Teras Coffee
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <NavList role={role} onNavigate={() => setOpen(false)} />
          </div>
          <div className="border-t border-border p-3">
            <UserMenu />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
