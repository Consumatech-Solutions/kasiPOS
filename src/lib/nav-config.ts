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
  labelKey: string;
  icon: React.ElementType;
  featureFlag?: keyof AppSettings;
  roles?: User["role"][];
};

export const navItems: NavItem[] = [
  { href: "/", labelKey: "nav.home", icon: Home },
  { href: "/catalogue", labelKey: "nav.catalogue", icon: BookOpen },
  { href: "/inventory", labelKey: "nav.inventory", icon: LayoutGrid },
  { href: "/sale", labelKey: "nav.sales", icon: DollarSign },
  { href: "/transactions", labelKey: "nav.orders", icon: ScrollText },
  { href: "/customers", labelKey: "nav.customers", icon: Users },
  {
    href: "/buy-stock",
    labelKey: "nav.buyStock",
    icon: ShoppingCart,
    featureFlag: "buyStock",
  },
  {
    href: "/vouchers",
    labelKey: "nav.campaigns",
    icon: Ticket,
    featureFlag: "campaigns",
  },
  {
    href: "/marketplace",
    labelKey: "nav.marketplace",
    icon: ShoppingBasket,
    featureFlag: "marketplace",
  },
  { href: "/boph", labelKey: "nav.boph", icon: PackageCheck, featureFlag: "boph" },
  {
    href: "/settings",
    labelKey: "nav.settings",
    icon: Settings,
    roles: ["admin", "store_admin"],
  },
];
