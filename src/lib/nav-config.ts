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
  LayoutDashboard,
} from "lucide-react";
import { AppSettings, User } from "@/types";
import { ALL_ROLES, MANAGEMENT_ROLES } from "@/lib/role-permissions";

export const OFFLINE_FIRST_PATHS = [
  "/dashboard",
  "/",
  "/catalogue",
  "/inventory",
  "/customers",
  "/sale",
] as const;

type NavItem = {
  href: string;
  /** i18n key in `translation` namespace (e.g. nav.home) */
  labelKey: string;
  icon: React.ElementType;
  featureFlag?: keyof AppSettings;
  roles?: User["role"][];
};

export const navItems: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "nav.dashboard",
    icon: LayoutDashboard,
    roles: MANAGEMENT_ROLES,
  },
  { href: "/", labelKey: "nav.home", icon: Home, roles: ALL_ROLES },
  {
    href: "/catalogue",
    labelKey: "nav.catalogue",
    icon: BookOpen,
    roles: MANAGEMENT_ROLES,
  },
  {
    href: "/inventory",
    labelKey: "nav.inventory",
    icon: LayoutGrid,
    roles: MANAGEMENT_ROLES,
  },
  { href: "/sale", labelKey: "nav.sales", icon: DollarSign, roles: ALL_ROLES },
  {
    href: "/transactions",
    labelKey: "nav.orders",
    icon: ScrollText,
    roles: ALL_ROLES,
  },
  {
    href: "/customers",
    labelKey: "nav.customers",
    icon: Users,
    roles: MANAGEMENT_ROLES,
  },
  {
    href: "/buy-stock",
    labelKey: "nav.buyStock",
    icon: ShoppingCart,
    featureFlag: "buyStock",
    roles: MANAGEMENT_ROLES,
  },
  {
    href: "/vouchers",
    labelKey: "nav.campaigns",
    icon: Ticket,
    featureFlag: "campaigns",
    roles: MANAGEMENT_ROLES,
  },
  {
    href: "/marketplace",
    labelKey: "nav.marketplace",
    icon: ShoppingBasket,
    featureFlag: "marketplace",
    roles: MANAGEMENT_ROLES,
  },
  {
    href: "/boph",
    labelKey: "nav.boph",
    icon: PackageCheck,
    featureFlag: "boph",
    roles: MANAGEMENT_ROLES,
  },
  {
    href: "/settings",
    labelKey: "nav.settings",
    icon: Settings,
    roles: MANAGEMENT_ROLES,
  },
];
