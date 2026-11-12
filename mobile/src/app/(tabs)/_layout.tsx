import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "../../store/AppStore";
import { useTheme } from "../../store/Theme";
import { DesktopNav } from "../../components/DesktopNav";
import { useDesktop } from "../../lib/desktop";

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, color }: { name: IconName; color: ColorValue }) {
  return <Ionicons name={name} size={22} color={String(color)} />;
}

const icon = (active: IconName, inactive: IconName) =>
  function Icon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <TabIcon name={focused ? active : inactive} color={color} />;
  };

export default function TabsLayout() {
  const { palette: C } = useTheme();
  const { user } = useApp();
  const desktop = useDesktop();
  // Altura + padding da área segura pra barra de gestos/home não comer a tab bar.
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      {desktop ? <DesktopNav /> : null}
      <Tabs
      tabBar={desktop ? () => null : undefined}
      screenOptions={{
        headerShown: false,
        tabBarPosition: "bottom",
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          backgroundColor: C.card,
          borderTopColor: C.line,
          borderTopWidth: 1,
          paddingBottom: Math.max(insets.bottom, 4),
          height: 56 + insets.bottom,
        },
        tabBarLabelStyle: { fontFamily: "Montserrat_700Bold", fontSize: 11 },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Palpite",
          tabBarIcon: icon("football", "football-outline"),
        }}
      />
      <Tabs.Screen
        name="desafio"
        options={{
          title: "Desafio",
          tabBarIcon: icon("medal", "medal-outline"),
        }}
      />
      <Tabs.Screen
        name="ranking"
        options={{
          title: "Ranking",
          tabBarIcon: icon("trophy", "trophy-outline"),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarIcon: icon("person", "person-outline"),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          href: user?.is_admin ? undefined : null,
          tabBarIcon: icon("construct", "construct-outline"),
        }}
      />
      </Tabs>
    </View>
  );
}
