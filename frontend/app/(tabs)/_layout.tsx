import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { useIsDesktopWeb } from '@/hooks/useResponsive';
import { NAV_ITEMS } from '@/constants/navigation';

/**
 * Phone / mobile-web tab bar. On desktop web the bar is hidden and the
 * persistent DesktopSidebar (mounted in app/_layout.tsx) takes over, using
 * the same NAV_ITEMS so order and labels always match.
 */
export default function TabsLayout() {
  const isDesktopWeb = useIsDesktopWeb();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        // Six tabs share a 360–390px phone: no side padding, so "Exercises" fits.
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarStyle: isDesktopWeb
          ? { display: 'none' }
          : {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              // The default 49px bar is too short for icon + label on web (labels get
              // clipped). React Navigation pads the bottom by the home-indicator inset
              // itself, so include it in the height.
              height: 58 + insets.bottom,
            },
      }}
    >
      {NAV_ITEMS.map((item) => (
        <Tabs.Screen
          key={item.name}
          name={item.name}
          options={{
            title: item.title,
            // Own label: the default one adds margins and ellipsizes "Exercises" at 360px.
            tabBarLabel: ({ color }) => (
              <Text style={{ color, fontSize: 10.5, fontWeight: '600', letterSpacing: -0.1 }}>{item.title}</Text>
            ),
            tabBarIcon: ({ focused, color }) => (
              <Ionicons name={focused ? item.iconActive : item.icon} size={22} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
