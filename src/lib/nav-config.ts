
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
} from 'lucide-react';
import { AppSettings } from '@/types';

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  featureFlag?: keyof AppSettings;
}

export const navItems: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/catalogue', label: 'Catalogue', icon: BookOpen },
  { href: '/inventory', label: 'Inventory', icon: LayoutGrid },
  { href: '/transactions', label: 'Orders', icon: ScrollText },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/vouchers', label: 'Campaigns', icon: Ticket, featureFlag: 'campaigns' },
  { href: '/marketplace', label: 'Marketplace', icon: ShoppingBasket, featureFlag: 'marketplace' },
  { href: '/boph', label: 'BOPH', icon: PackageCheck, featureFlag: 'boph' },
  { href: '/settings', label: 'Settings', icon: Settings },
];
