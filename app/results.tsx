import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Palette, Radius, Shadow, Spacing, Typography, UI } from "../constants/theme";
import {
  PharmacyResult,
  searchMedicineAndNearbyPharmacies,
  searchNearbyPharmaciesByFilter,
} from "../lib/search";

import AppMap from "../components/map";

export default function ResultsScreen() {
  const { q, filter } = useLocalSearchParams<{ q: string; filter?: string }>();
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  // Maps are supported differently on web using the `.web.tsx` extension fallback
  const canShowMap = true;

  const [userLoc, setUserLoc] = useState<{ lat: number, lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [medicineName, setMedicineName] = useState<string | null>(null);
  const [items, setItems] = useState<PharmacyResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        setLoading(true);

        const query = (q ?? "").trim();
        const hasQuery = query.length > 0;
        const hasFilter = !!filter && filter !== "none";

        // Rien à chercher
        if (!hasQuery && !hasFilter) {
          setError("Entrez un médicament ou sélectionnez un filtre.");
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") throw new Error("Permission GPS refusée.");

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setUserLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });

        if (hasQuery) {
          // Recherche médicament + filtre optionnel
          const { medicineName: name, pharmacies } =
            await searchMedicineAndNearbyPharmacies(
              query,
              loc.coords.latitude,
              loc.coords.longitude,
              filter || undefined,
            );
          setMedicineName(name);
          setItems(pharmacies);
        } else {
          // Recherche filtre seul
          const pharmacies = await searchNearbyPharmaciesByFilter(
            loc.coords.latitude,
            loc.coords.longitude,
            filter!,
          );
          setMedicineName(null);
          setItems(pharmacies);
        }
      } catch (e: any) {
        setError(e?.message ?? "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    })();
  }, [q, filter]);

  if (loading) {
    return (
      <View style={[UI.screen, { padding: Spacing.lg, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: Palette.textSecondary, fontWeight: "600" }}>Recherche en cours...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[UI.screen, { padding: Spacing.xl, gap: Spacing.lg, justifyContent: "center" }]}>
        <Text style={{ fontSize: 64, alignSelf: "center" }}>⚠️</Text>
        <Text style={{ fontSize: 24, fontWeight: "800", color: Palette.dangerText, textAlign: "center" }}>Oups!</Text>
        <Text style={{ color: Palette.textSecondary, textAlign: "center", fontSize: 16 }}>{error}</Text>
        <Pressable
          onPress={() => router.back()}
          style={[UI.btnPrimary, { marginTop: Spacing.lg }]}
        >
          <Text style={Typography.button}>Retourner à la recherche</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={UI.screen}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>
              {medicineName
                ? `Stock : ${medicineName}`
                : filter && filter !== "none"
                  ? `Pharmacies : ${{ garde: "De Garde", "24h": "Ouvert 24/7", vaccin: "Vaccination", test: "Tests Rapides" }[filter] ?? filter}`
                  : "Résultats"}
            </Text>
            <Text style={styles.headerSubtitle}>
              {items.length} pharmacie(s) à proximité
            </Text>
          </View>

          {canShowMap && (
            <Pressable
              onPress={() => setViewMode(viewMode === "list" ? "map" : "list")}
              style={styles.viewToggleBtn}
            >
              <Text style={styles.viewToggleIcon}>{viewMode === "list" ? "🗺️" : "📋"}</Text>
            </Pressable>
          )}
        </View>

        {filter && filter !== "none" && (
          <View style={styles.filterRowActive}>
            <View style={styles.appliedFilterBadge}>
              <Text style={styles.appliedFilterText}>
                Filtre actif : {filter === "garde" ? "De Garde" : filter === "24h" ? "Ouvert 24/7" : filter === "vaccin" ? "Vaccination" : "Tests Rapides"}
              </Text>
            </View>
            <Pressable
              style={styles.clearFilterBtn}
              onPress={() => router.setParams({ filter: "none" })}
            >
              <Text style={styles.clearFilterText}>❌ Effacer</Text>
            </Pressable>
          </View>
        )}
      </View>

      {viewMode === "map" && userLoc ? (
        <AppMap
          userLoc={userLoc}
          items={items}
          onMarkerPress={(item) =>
            router.push({
              pathname: "/pharmacy",
              params: {
                id: item.id,
                distanceKm: item.distanceKm.toFixed(2),
                lat: String(item.lat),
                lng: String(item.lng),
                name: item.name,
              },
            })
          }
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={items}
          keyExtractor={(it) => it.id}
          ItemSeparatorComponent={() => <View style={UI.separator} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/pharmacy",
                  params: {
                    id: item.id,
                    distanceKm: item.distanceKm.toFixed(2),
                    lat: String(item.lat),
                    lng: String(item.lng),
                    name: item.name,
                  },
                })
              }
              style={({ pressed }) => [
                styles.card,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceText}>{item.distanceKm.toFixed(2)} km</Text>
                </View>
              </View>

              <Text style={styles.cardAddress} numberOfLines={2}>
                {item.address ?? "Adresse indisponible"}
              </Text>

              <View style={styles.cardFooter}>
                <View style={styles.stockBadge}>
                  <Text style={styles.stockIcon}>📦</Text>
                  <Text style={styles.stockText}>Stock: {item.quantity}</Text>
                </View>
                <Text style={styles.viewDetailsText}>Voir détails ➔</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: Spacing.lg,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    zIndex: 10,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewToggleBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  viewToggleIcon: {
    fontSize: 20,
  },
  filterRowActive: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
  },
  appliedFilterBadge: {
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  appliedFilterText: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.primaryDark,
  },
  clearFilterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    backgroundColor: Palette.border,
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.dangerText,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Palette.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: Palette.textSecondary,
    fontWeight: "500",
  },
  list: {
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Palette.surfaceElevated,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.borderStrong,
    ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: Palette.primaryDark,
    marginRight: Spacing.sm,
  },
  distanceBadge: {
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  cardAddress: {
    fontSize: 14,
    color: Palette.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  stockBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.successLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    gap: 4,
  },
  stockIcon: {
    fontSize: 14,
  },
  stockText: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.successText,
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.primary,
  },
});
