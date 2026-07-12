import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Package, Coffee, ShoppingCart, HandCoins, Wallet, Calculator, BarChart3 } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Urutan HARUS sama dengan claude.md Bagian 4 (+ Hutang setelah Transaksi, Fitur 3) —
// jangan hilangkan satupun menu saat collapse mobile.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventaris", label: "Inventaris", icon: Package },
  { href: "/menu", label: "Menu", icon: Coffee },
  { href: "/transaksi", label: "Transaksi", icon: ShoppingCart },
  { href: "/hutang", label: "Hutang", icon: HandCoins },
  { href: "/keuangan", label: "Keuangan", icon: Wallet },
  { href: "/tutup-kasir", label: "Tutup Kasir", icon: Calculator },
  { href: "/laporan", label: "Laporan", icon: BarChart3 },
];
