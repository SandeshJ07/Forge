import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

export interface NavItem {
  /** Tab route name inside app/(tabs). */
  name: 'index' | 'log' | 'plan' | 'measurements' | 'glossary' | 'settings';
  title: string;
  href: string;
  icon: IconName;
  iconActive: IconName;
  /** Other routes that belong to this section, so the sidebar highlight stays put on detail screens. */
  matches?: string[];
}

/** Single source of truth for nav order + labels, shared by the phone tab bar and the desktop sidebar. */
export const NAV_ITEMS: NavItem[] = [
  { name: 'index', title: 'Home', href: '/', icon: 'home-outline', iconActive: 'home', matches: ['/records'] },
  { name: 'log', title: 'Log', href: '/log', icon: 'barbell-outline', iconActive: 'barbell', matches: ['/workout'] },
  { name: 'plan', title: 'Plan', href: '/plan', icon: 'calendar-outline', iconActive: 'calendar' },
  {
    name: 'measurements',
    title: 'Progress',
    href: '/measurements',
    icon: 'trending-up-outline',
    iconActive: 'trending-up',
  },
  {
    name: 'glossary',
    title: 'Exercises',
    href: '/glossary',
    icon: 'library-outline',
    iconActive: 'library',
    matches: ['/exercise'],
  },
  { name: 'settings', title: 'Settings', href: '/settings', icon: 'settings-outline', iconActive: 'settings' },
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const matchesExtra = (item.matches ?? []).some((prefix) => pathname.startsWith(prefix));
  if (item.href === '/') return pathname === '/' || matchesExtra;
  return pathname.startsWith(item.href) || matchesExtra;
}
