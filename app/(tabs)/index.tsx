import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Palette, Radius, Shadow, Spacing } from "../../constants/theme";
import { addToHistory } from "../../lib/history";
import { scanPrescription } from "../../lib/ocr";
import { supabase } from "../../lib/supabase";

export default function HomeScreen() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Lire la session initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
    // Écouter les changements en temps réel
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleAuthBtn = () => {
    if (isLoggedIn) {
      Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
        { text: "Annuler", style: "cancel" },
        {
          text: "Se déconnecter",
          style: "destructive",
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace("/auth" as any);
          },
        },
      ]);
    } else {
      router.push("/auth" as any);
    }
  };

  const filters = [
    { id: "garde", label: "De Garde", icon: "🚨" },
    { id: "24h", label: "Ouvert 24/7", icon: "🌙" },
    { id: "vaccin", label: "Vaccination", icon: "💉" },
    { id: "test", label: "Tests Rapides", icon: "🧪" },
  ];

  const handleSearch = async () => {
    const q = query.trim();
    if (!q && !selectedFilter) return;
    if (q) await addToHistory(q);

    router.push({
      pathname: "/results",
      params: {
        q,
        filter: selectedFilter || ""
      }
    });
  };

  const handleScan = async () => {
    try {
      setIsScanning(true);
      const meds = await scanPrescription();
      if (meds && meds.length > 0) {
        setQuery(meds[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={Keyboard.dismiss}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Hero gradient header ── */}
        <LinearGradient
          colors={["#0369A1", "#0EA5E9", "#38BDF8"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Decorative circles */}
          <View style={styles.circle1} />
          <View style={styles.circle2} />

          {/* Auth button top-right */}
          <Pressable
            onPress={handleAuthBtn}
            style={({ pressed }) => [
              styles.authBtn,
              isLoggedIn && styles.authBtnLoggedIn,
              pressed && { opacity: 0.75 },
            ]}
          >
            <Text style={styles.authBtnIcon}>{isLoggedIn ? "⎋" : "🔐"}</Text>
            <Text style={styles.authBtnText}>{isLoggedIn ? "Déconnexion" : "Connexion"}</Text>
          </Pressable>

          <View style={styles.heroContent}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoEmoji}>💊</Text>
            </View>
            <Text style={styles.heroTitle}>MediFind</Text>
            <Text style={styles.heroSubtitle}>
              Trouvez les pharmacies proches{"\n"}avec votre médicament en stock.
            </Text>
          </View>
        </LinearGradient>

        {/* ── Search card ── */}
        <View style={styles.searchCard}>
          {/* Label */}
          <Text style={styles.sectionLabel}>🔍  Rechercher un médicament</Text>

          {/* Input block visually acts as the input container */}
          <View style={[
            styles.inputContainer,
            focused && styles.inputFocused,
          ]}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Ex : Doliprane, Advil..."
              placeholderTextColor={Palette.textMuted}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={styles.inputInner}
            />

            <Pressable
              onPress={handleScan}
              style={styles.scanBtn}
              disabled={isScanning}
            >
              <Text style={styles.scanIcon}>{isScanning ? "⏳" : "📷"}</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={handleSearch}
            style={({ pressed }) => [
              styles.btnPrimary,
              pressed && { opacity: 0.88 },
            ]}
          >
            <Text style={styles.btnPrimaryText}>Rechercher</Text>
          </Pressable>

          {/* ── Quick Filters ── */}
          <View style={styles.filtersContainer}>
            <Text style={styles.sectionLabelSmall}>Filtres rapides</Text>
            <View style={styles.filtersRow}>
              {filters.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => setSelectedFilter(selectedFilter === f.id ? null : f.id)}
                  style={[
                    styles.filterChip,
                    selectedFilter === f.id && styles.filterChipActive
                  ]}
                >
                  <Text style={styles.filterIcon}>{f.icon}</Text>
                  <Text style={[
                    styles.filterText,
                    selectedFilter === f.id && styles.filterTextActive
                  ]}>
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* ── Quick tips ── */}
        <View style={styles.tipsRow}>
          <TipChip icon="📍" text="Localisation GPS" />
          <TipChip icon="⚡" text="Résultats en temps réel" />
          <TipChip icon="⭐" text="Pharmacies favorites" />
        </View>
      </ScrollView>

      {/* ── Floating Action Button for AI Assistant ── */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] }
        ]}
        onPress={() => router.push("/assistant")}
      >
        <LinearGradient
          colors={["#0EA5E9", "#0369A1"]}
          style={styles.fabGradient}
        >
          <Text style={styles.fabIcon}>✨</Text>
        </LinearGradient>
      </Pressable>
    </SafeAreaView>
  );
}

function TipChip({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.tipChip}>
      <Text style={styles.tipIcon}>{icon}</Text>
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // Hero
  hero: {
    paddingTop: 24,
    paddingBottom: 60,
    paddingHorizontal: Spacing.lg,
    overflow: "hidden",
    position: "relative",
  },
  circle1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.07)",
    top: -60,
    right: -40,
  },
  circle2: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.05)",
    bottom: -30,
    left: -20,
  },
  heroContent: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoEmoji: {
    fontSize: 36,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 22,
  },
  // Search card
  searchCard: {
    marginHorizontal: Spacing.lg,
    marginTop: -30,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadow.lg,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.textMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.background,
    borderWidth: 1.5,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
  },
  inputFocused: {
    borderColor: Palette.primary,
    backgroundColor: "#EFF9FF",
  },
  inputInner: {
    flex: 1,
    fontSize: 16,
    color: Palette.textPrimary,
  },
  scanBtn: {
    padding: 8,
    backgroundColor: Palette.surface,
    borderRadius: Radius.full,
    ...Shadow.sm,
  },
  scanIcon: {
    fontSize: 20,
  },
  btnPrimary: {
    backgroundColor: Palette.primary,
    paddingVertical: 15,
    borderRadius: Radius.full,
    alignItems: "center",
    ...Shadow.md,
  },
  btnPrimaryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.3,
  },
  // Filters
  filtersContainer: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  sectionLabelSmall: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
    textTransform: "uppercase",
  },
  filtersRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  filterChipActive: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
  filterIcon: {
    fontSize: 14,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.textSecondary,
  },
  filterTextActive: {
    color: Palette.primaryDark,
  },
  // Tips
  tipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    justifyContent: "center",
  },
  tipChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Palette.surface,
    borderRadius: Radius.full,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tipIcon: {
    fontSize: 13,
  },
  tipText: {
    fontSize: 12,
    color: Palette.textSecondary,
    fontWeight: "600",
  },
  authBtn: {
    position: "absolute",
    top: 14,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: Radius.full,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    zIndex: 10,
  },
  authBtnIcon: {
    fontSize: 15,
  },
  authBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  authBtnLoggedIn: {
    backgroundColor: "rgba(239,68,68,0.25)",
    borderColor: "rgba(239,68,68,0.5)",
  },
  // FAB
  fab: {
    position: "absolute",
    bottom: 30,
    right: Spacing.lg,
    borderRadius: Radius.full,
    ...Shadow.lg,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  fabIcon: {
    fontSize: 26,
  },
});
