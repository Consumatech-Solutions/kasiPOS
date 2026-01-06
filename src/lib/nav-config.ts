
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
  { href: '/inventory', label: 'Inventory', icon: LayoutGrid },
  { href: '/transactions', label: 'Orders', icon: ScrollText },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/vouchers', label: 'Campaigns', icon: Ticket },
  { href: '/reports', label: 'Reports', icon: BarChart },
  { href: '/settings', label: 'Settings', icon: Settings },
];
