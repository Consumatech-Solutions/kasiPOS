
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

export const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/catalogue', label: 'Catalogue', icon: BookOpen },
  { href: '/inventory', label: 'Inventory', icon: LayoutGrid },
  { href: '/transactions', label: 'Orders', icon: ScrollText },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/vouchers', label: 'Campaigns', icon: Ticket },
  { href: '/marketplace', label: 'Marketplace', icon: ShoppingBasket },
  { href: '/boph', label: 'BOPH', icon: PackageCheck },
  { href: '/settings', label: 'Settings', icon: Settings },
];
