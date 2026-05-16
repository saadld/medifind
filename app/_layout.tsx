import { Session } from "@supabase/supabase-js";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { supabase } from "../lib/supabase";

const ADMIN_EMAILS = ["admin@medifind.com", "admin@admin.com"];

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // Récupérer la session initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Écouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return; // Encore en chargement

    if (!session) {
      // Non connecté
      router.replace("/auth" as any);
      return;
    }

    // Connecté — détecter le rôle
    const email = session.user.email ?? "";

    if (ADMIN_EMAILS.includes(email.toLowerCase())) {
      router.replace("/(admin)" as any);
      return;
    }

    // Vérifier si c'est un pro (pharmacie liée)
    supabase
      .from("pharmacies")
      .select("id")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data: pharmacy }) => {
        if (pharmacy) {
          router.replace("/(pro)" as any);
        } else {
          router.replace("/(tabs)" as any);
        }
      });
  }, [session]);

  // Écran de chargement pendant la vérification
  if (session === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ contentStyle: { backgroundColor: "#fff" } }}>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(pro)" options={{ headerShown: false }} />
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen name="results" options={{ headerShown: false }} />
        <Stack.Screen name="pharmacy" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
        <Stack.Screen name="assistant" options={{ presentation: "modal", headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
