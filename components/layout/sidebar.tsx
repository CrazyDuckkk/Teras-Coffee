import { Coffee } from "lucide-react";
import { NavList } from "./nav-list";
import { UserMenu } from "./user-menu";

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-65 md:shrink-0 md:flex-col md:border-r md:border-sidebar-border md:bg-sidebar">
      <div className="flex h-16 items-center gap-2 px-5">
        <Coffee className="size-5 text-primary" />
        <span className="font-semibold text-sidebar-foreground">Teras Coffee</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <NavList />
      </div>
      <div className="border-t border-sidebar-border p-3">
        <UserMenu />
      </div>
    </aside>
  );
}
