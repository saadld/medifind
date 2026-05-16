import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Palette } from "@/constants/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Palette.primary,
        tabBarInactiveTintColor: Palette.textMuted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: Palette.surface,
          borderTopWidth: 1,
          borderTopColor: Palette.border,
          paddingTop: 5,
          height: 70,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: "Historique",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="clock.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favoris",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="star.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="treatments"
        options={{
          title: "Traitements",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="list.bullet.clipboard.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="reservations"
        options={{
          title: "Réservations",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="calendar.badge.clock" color={color} />
          ),
        }}
      />

      {/* Caché de la tab bar mais déclaré pour éviter le bug de rendu sans tabs */}
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
