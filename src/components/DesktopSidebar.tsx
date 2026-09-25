import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Logo } from '@/components/ui/Logo';
import { NAV_ITEMS, isNavItemActive, type NavItem } from '@/constants/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { colors, radii, spacing } from '@/constants/theme';

/** Persistent left nav for desktop web — shown on every signed-in screen, including detail screens. */
export function DesktopSidebar() {
  const pathname = usePathname();
  const username = useAuthStore((s) => s.session?.username);

  return (
    <View style={styles.sidebar}>
      <View style={styles.logoRow}>
        <Logo size={26} textSize={19} />
      </View>
      <View style={styles.navList}>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.name} item={item} active={isNavItemActive(item, pathname)} />
        ))}
      </View>
      {username ? (
        <View style={styles.footer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.username} numberOfLines={1}>
            {username}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      onPress={() => router.navigate(item.href as never)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[styles.navItem, active && styles.navItemActive, hovered && !active && styles.navItemHovered]}
    >
      <Ionicons
        name={active ? item.iconActive : item.icon}
        size={19}
        color={active ? colors.primary : colors.textMuted}
      />
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    gap: 2,
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    cursor: 'pointer',
  },
  navItemHovered: {
    backgroundColor: colors.surfaceAlt,
  },
  navItemActive: {
    backgroundColor: colors.primaryMuted,
  },
  navLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  navLabelActive: {
    color: colors.text,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  username: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});
