import type { LucideIcon } from "lucide-react";
import {
  Calculator,
  ClipboardCheck,
  Coffee,
  HandCoins,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import type { UserRole } from "@/lib/roles";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const OWNER_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventaris", label: "Inventaris", icon: Package },
  { href: "/menu", label: "Menu", icon: Coffee },
  { href: "/transaksi", label: "Transaksi", icon: ShoppingCart },
  { href: "/persetujuan", label: "Persetujuan", icon: ClipboardCheck },
  { href: "/hutang", label: "Hutang", icon: HandCoins },
  { href: "/keuangan", label: "Keuangan", icon: Wallet },
  { href: "/pengaturan/akun", label: "Pengaturan", icon: Settings },
];

const CASHIER_NAV_ITEMS: NavItem[] = [
  { href: "/transaksi", label: "Transaksi", icon: ShoppingCart },
  { href: "/hutang", label: "Hutang", icon: HandCoins },
  { href: "/inventaris", label: "Stok Bahan", icon: Package },
  { href: "/tutup-kasir", label: "Tutup Kasir", icon: Calculator },
];

export function getNavItemsForRole(role: UserRole): NavItem[] {
  return role === "owner" ? OWNER_NAV_ITEMS : CASHIER_NAV_ITEMS;
}
