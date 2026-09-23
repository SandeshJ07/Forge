import { useState } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '@/constants/theme';
import { useIsDesktopWeb } from '@/hooks/useResponsive';
import { Logo } from '@/components/ui/Logo';

const ICONS: Record<string, string> = {
  index: '🏠',
  glossary: '📚',
  log: '📝',
  measurements: '📏',
  plan: '🗓️',
  settings: '⚙️',
};

const NAV_ITEMS: { name: string; title: string }[] = [
  { name: 'index', title: 'Home' },
  { name: 'log', title: 'Log' },
  { name: 'plan', title: 'Plan' },
  { name: 'measurements', title: 'Measurements' },
  { name: 'glossary', title: 'Glossary' },
  { name: 'settings', title: 'Settings' },
];

export default function TabsLayout() {
  const isDesktopWeb = useIsDesktopWeb();

  return (
    <View style={styles.root}>
      {isDesktopWeb ? <DesktopSidebar /> : null}
      <View style={styles.content}>
        <Tabs
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarStyle: [{ backgroundColor: colors.surface, borderTopColor: colors.border }, isDesktopWeb && styles.hidden],
            tabBarIcon: () => <Text style={{ fontSize: 18 }}>{ICONS[route.name]}</Text>,
          })}
        >
          <Tabs.Screen name="index" options={{ title: 'Home' }} />
          <Tabs.Screen name="glossary" options={{ title: 'Glossary' }} />
          <Tabs.Screen name="log" options={{ title: 'Log' }} />
          <Tabs.Screen name="measurements" options={{ title: 'Measurements' }} />
          <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
          <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
        </Tabs>
      </View>
    </View>
  );
}

function DesktopSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.sidebar}>
      <View style={styles.logoRow}>
        <Logo size={26} textSize={19} />
      </View>
      <View style={styles.navList}>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.name} item={item} pathname={pathname} router={router} />
        ))}
      </View>
    </View>
  );
}

function NavLink({
  item,
  pathname,
  router,
}: {
  item: { name: string; title: string };
  pathname: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [hovered, setHovered] = useState(false);
  const href = item.name === 'index' ? '/' : `/${item.name}`;
  const active = item.name === 'index' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Pressable
      onPress={() => router.push((item.name === 'index' ? '/' : `/${item.name}`) as never)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.navItem,
        active && styles.navItemActive,
        (hovered || pressed) && !active && styles.navItemHovered,
      ]}
    >
      <Text style={styles.navIcon}>{ICONS[item.name]}</Text>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
  sidebar: {
    width: 232,
    flexShrink: 0,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  logoRow: {
    paddingHorizontal: spacing.sm,
  },
  navList: {
    gap: spacing.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    cursor: 'pointer',
  },
  navItemHovered: {
    backgroundColor: colors.surfaceAlt,
  },
  navItemActive: {
    backgroundColor: colors.primaryMuted,
  },
  navIcon: {
    fontSize: 16,
  },
  navLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  navLabelActive: {
    color: colors.primary,
  },
});
