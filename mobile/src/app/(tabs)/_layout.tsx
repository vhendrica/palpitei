import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";

import { useApp } from "../../store/AppStore";
import { useTheme } from "../../store/Theme";

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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          backgroundColor: C.card,
          borderTopColor: C.line,
          borderTopWidth: 1,
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
  );
}
