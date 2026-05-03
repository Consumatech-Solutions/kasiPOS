import {
  Home,
  LayoutGrid,
  Users,
  ScrollText,
  Ticket,
  Settings,
  BookOpen,
  ShoppingBasket,
  PackageCheck,
  ShoppingCart,
  DollarSign,
} from "lucide-react";
import { AppSettings, User } from "@/types";

export const OFFLINE_FIRST_PATHS = [
  "/",
  "/catalogue",
  "/inventory",
  "/customers",
  "/sale",
] as const;

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  featureFlag?: keyof AppSettings;
  roles?: User["role"][];
};

export const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/catalogue", label: "Catalogue", icon: BookOpen },
  { href: "/inventory", label: "Inventory", icon: LayoutGrid },
  { href: "/sale", label: "Sales", icon: DollarSign },
  { href: "/transactions", label: "Orders", icon: ScrollText },
  { href: "/customers", label: "Customers", icon: Users },
  {
    href: "/buy-stock",
    label: "Buy Stock",
    icon: ShoppingCart,
    featureFlag: "buyStock",
  },
  {
    href: "/vouchers",
    label: "Campaigns",
    icon: Ticket,
    featureFlag: "campaigns",
  },
  {
    href: "/marketplace",
    label: "Marketplace",
    icon: ShoppingBasket,
    featureFlag: "marketplace",
  },
  { href: "/boph", label: "BOPH", icon: PackageCheck, featureFlag: "boph" },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    roles: ["admin", "store_admin"],
  },
];
