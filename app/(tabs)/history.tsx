import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Palette, Radius, Shadow, Spacing, UI } from "../../constants/theme";
import {
  clearHistory,
  getHistory,
  HistoryItem,
  removeFromHistory,
} from "../../lib/history";

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function HistoryScreen() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await getHistory();
    setItems(data);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  useEffect(() => {
    load();
  }, []);

  const handleClear = async () => {
    await clearHistory();
    setItems([]);
  };

  const handleRemoveOne = async (at: string) => {
    const next = await removeFromHistory(at);
    setItems(next);
  };

  if (loading) {
    return (
      <SafeAreaView style={[UI.screen, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: Palette.textSecondary, fontWeight: "600" }}>Chargement...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={UI.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Historique ⏱️</Text>

        <Pressable
          onPress={handleClear}
          style={({ pressed }) => [
            styles.clearBtn,
            pressed && { backgroundColor: Palette.dangerLight }
          ]}
        >
          <Text style={styles.clearBtnText}>Vider</Text>
        </Pressable>
      </View>

      {/* Liste */}
      {items.length === 0 ? (
        <View style={UI.emptyState}>
          <Text style={{ fontSize: 44, opacity: 0.8 }}>🕰️</Text>
          <Text style={UI.emptyStateText}>Aucune recherche pour le moment.</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={items}
          keyExtractor={(it) => it.at}
          ItemSeparatorComponent={() => <View style={UI.separator} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/results",
                    params: { q: item.query },
                  })
                }
                style={styles.cardContent}
              >
                <Text style={styles.cardTitle}>
                  {item.query}
                </Text>
                <Text style={styles.cardSubtitle}>{formatDate(item.at)}</Text>
              </Pressable>

              <Pressable
                onPress={() => handleRemoveOne(item.at)}
                style={({ pressed }) => [
                  styles.removeBtn,
                  pressed && { backgroundColor: Palette.dangerLight }
                ]}
              >
                <Text style={styles.removeIcon}>🗑️</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Palette.textPrimary,
    letterSpacing: -0.5,
  },
  clearBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
    backgroundColor: Palette.border,
  },
  clearBtnText: {
    fontWeight: "700",
    color: Palette.dangerText,
    fontSize: 14,
  },
  list: {
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Palette.borderStrong,
    ...Shadow.sm,
  },
  cardContent: {
    flex: 1,
    paddingRight: Spacing.md,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Palette.textMuted,
  },
  removeBtn: {
    padding: 12,
    borderRadius: Radius.full,
    backgroundColor: Palette.surface,
  },
  removeIcon: {
    fontSize: 16,
  },
});
