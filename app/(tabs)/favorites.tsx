import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Palette, Radius, Shadow, Spacing, UI } from "../../constants/theme";
import {
  FavoritePharmacy,
  listFavorites,
  removeFavorite,
} from "../../lib/favorites";

export default function FavoritesScreen() {
  const [items, setItems] = useState<FavoritePharmacy[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listFavorites();
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  useEffect(() => {
    load();
  }, []);

  const handleRemove = async (pharmacyId: string) => {
    await removeFavorite(pharmacyId);
    await load();
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
      <View style={styles.header}>
        <Text style={styles.title}>Favoris ⭐</Text>
      </View>

      {items.length === 0 ? (
        <View style={UI.emptyState}>
          <Text style={{ fontSize: 44, opacity: 0.8 }}>🏥</Text>
          <Text style={UI.emptyStateText}>Aucune pharmacie en favoris.</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={items}
          keyExtractor={(it) => it.pharmacy_id}
          ItemSeparatorComponent={() => <View style={UI.separator} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/pharmacy",
                    params: { id: item.pharmacy.id },
                  })
                }
                style={styles.cardContent}
              >
                <Text style={styles.cardTitle}>
                  {item.pharmacy.name}
                </Text>
                <Text style={styles.cardSubtitle} numberOfLines={2}>
                  {item.pharmacy.address ?? "Adresse indisponible"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleRemove(item.pharmacy.id)}
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
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Palette.textPrimary,
    letterSpacing: -0.5,
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
    fontSize: 14,
    color: Palette.textSecondary,
    lineHeight: 20,
  },
  removeBtn: {
    padding: 12,
    borderRadius: Radius.full,
    backgroundColor: Palette.border,
  },
  removeIcon: {
    fontSize: 16,
  },
});
