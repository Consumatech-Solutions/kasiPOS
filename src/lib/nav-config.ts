
import {
  Home,
  LayoutGrid,
  Users,
  ScrollText,
  Ticket,
  BarChart,
  Settings,
} from 'lucide-react';

export const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/inventory', label: 'Catalogue', icon: LayoutGrid },
  { href: '/transactions', label: 'Orders', icon: ScrollText },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/vouchers', label: 'Vouchers', icon: Ticket },
  { href: '/reports', label: 'Reports', icon: BarChart },
  { href: '/settings', label: 'Settings', icon: Settings },
];
