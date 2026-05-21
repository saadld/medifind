import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Palette, Radius, Shadow, Spacing, Typography, UI } from "../constants/theme";
import { getDeviceId } from "../lib/device";
import { addFavorite, isFavorite, removeFavorite } from "../lib/favorites";
import { supabase } from "../lib/supabase";

type Pharmacy = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  hours_json: any;
  services_json: any;
};

type HoursLine = { label: string; value: string };

// ---------- Helpers horaires ----------

function formatHours(hours: any): HoursLine[] {
  if (!hours) return [];

  if (typeof hours === "string") {
    return [{ label: "Horaires", value: hours }];
  }

  if (typeof hours !== "object") return [];

  const labels: Record<string, string> = {
    mon_fri: "Lundi – Vendredi",
    mon: "Lundi",
    tue: "Mardi",
    wed: "Mercredi",
    thu: "Jeudi",
    fri: "Vendredi",
    sat: "Samedi",
    sun: "Dimanche",
  };

  const order = ["mon_fri", "mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const entries = Object.entries(hours) as [string, any][];

  entries.sort((a, b) => {
    const ia = order.indexOf(a[0]);
    const ib = order.indexOf(b[0]);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return entries.map(([key, value]) => {
    const label = labels[key] ?? key;

    if (typeof value !== "string") return { label, value: "—" };

    const normalized =
      value.toLowerCase() === "closed" ? "Fermé" : value.replaceAll("-", " – ");

    return { label, value: normalized };
  });
}

function timeToMinutes(t: string): number | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (
    Number.isNaN(hh) ||
    Number.isNaN(mm) ||
    hh < 0 ||
    hh > 23 ||
    mm < 0 ||
    mm > 59
  )
    return null;
  return hh * 60 + mm;
}

function parseRanges(value: string): Array<[number, number]> {
  const raw = value.trim().toLowerCase();
  if (!raw || raw === "closed") return [];

  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const ranges: Array<[number, number]> = [];

  for (const part of parts) {
    const [startStr, endStr] = part.split("-").map((s) => s.trim());
    if (!startStr || !endStr) continue;

    const start = timeToMinutes(startStr);
    const end = timeToMinutes(endStr);
    if (start == null || end == null) continue;

    ranges.push([start, end]);
  }

  return ranges;
}

function getDayKey(
  d: Date,
): "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun" {
  const day = d.getDay(); // 0=Sun ... 6=Sat
  switch (day) {
    case 0:
      return "sun";
    case 1:
      return "mon";
    case 2:
      return "tue";
    case 3:
      return "wed";
    case 4:
      return "thu";
    case 5:
      return "fri";
    default:
      return "sat";
  }
}

function isOpenNow(
  hours: any,
  now: Date = new Date(),
): { open: boolean; label: string } {
  if (!hours)
    return { open: false, label: "Horaires indisponibles" };

  if (typeof hours === "string") {
    return { open: true, label: hours }; // Can't easily check, but display the text
  }

  if (typeof hours !== "object")
    return { open: false, label: "Horaires indisponibles" };

  const dayKey = getDayKey(now);

  let todayValue: string | null =
    typeof hours[dayKey] === "string" ? hours[dayKey] : null;

  if (
    !todayValue &&
    ["mon", "tue", "wed", "thu", "fri"].includes(dayKey) &&
    typeof hours.mon_fri === "string"
  ) {
    todayValue = hours.mon_fri;
  }

  if (!todayValue) return { open: false, label: "Horaires indisponibles" };

  const raw = String(todayValue).trim().toLowerCase();
  if (raw === "closed") return { open: false, label: "Fermé aujourd’hui" };

  const ranges = parseRanges(raw);
  if (!ranges.length) return { open: false, label: "Horaires indisponibles" };

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const open = ranges.some(([start, end]) => {
    if (start < end) return currentMinutes >= start && currentMinutes < end;
    return currentMinutes >= start || currentMinutes < end; // traverse minuit
  });

  const pretty = raw.replaceAll("-", " – ");
  return { open, label: pretty };
}

// ---------- Maps helper ----------
function openDirections(lat: number, lng: number, label?: string) {
  const encodedLabel = encodeURIComponent(label ?? "Pharmacie");
  const destination = `${lat},${lng}`;

  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?daddr=${destination}&q=${encodedLabel}`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}&destination_place_id=&travelmode=driving`;

  Linking.openURL(url);
}

export default function PharmacyScreen() {
  const { id, distanceKm, lat, lng, name } = useLocalSearchParams<{
    id: string;
    distanceKm?: string;
    lat?: string;
    lng?: string;
    name?: string;
  }>();

  const [item, setItem] = useState<Pharmacy | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [favorite, setFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  // --- Reservation States ---
  const [reservationModalVisible, setReservationModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<any>(null);
  const [selectedStock, setSelectedStock] = useState<number>(0);
  const [quantity, setQuantity] = useState(1);
  const [prescriptionImage, setPrescriptionImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const pharmacyId = (id ?? "").trim();
        if (!pharmacyId) {
          setError("ID pharmacie manquant.");
          return;
        }

        const { data, error } = await supabase
          .from("pharmacies")
          .select("id,name,address,phone,hours_json,services_json")
          .eq("id", pharmacyId)
          .single();

        if (error) throw error;
        setItem(data);

        const fav = await isFavorite(pharmacyId);
        setFavorite(fav);
      } catch (e: any) {
        setError(e?.message ?? "Erreur inconnue");
      }
    })();
  }, [id]);

  const toggleFavorite = async () => {
    if (!item) return;

    try {
      setFavLoading(true);

      if (favorite) {
        await removeFavorite(item.id);
        setFavorite(false);
      } else {
        await addFavorite(item.id);
        setFavorite(true);
      }
    } catch (e: any) {
      console.error("Toggle Favorite Error:", e);
      Alert.alert("Erreur", e?.message || "Impossible de modifier les favoris");
    } finally {
      setFavLoading(false);
    }
  };

  // --- Reservation Logic ---

  const handleSearchMedicines = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      // Chercher uniquement dans le stock de CETTE pharmacie
      const { data, error } = await supabase
        .from("stocks")
        .select("quantity, medicine:medicines(id, name, strength, requires_prescription)")
        .eq("pharmacy_id", id)
        .gt("quantity", 0)
        .filter("medicines.name", "ilike", `%${query}%`);

      if (error) throw error;

      // Filtrer les résultats nuls (join manquant)
      const filtered = (data || []).filter((s: any) => s.medicine?.name?.toLowerCase().includes(query.toLowerCase()));
      setSearchResults(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setPrescriptionImage(result.assets[0].uri);
    }
  };

  const handleReserve = async () => {
    if (!selectedMedicine || !item) return;

    try {
      setSubmitting(true);

      // Validation ordonnance
      if (selectedMedicine.requires_prescription && !prescriptionImage) {
        Alert.alert(
          "Ordonnance obligatoire",
          "Ce médicament nécessite une ordonnance. Veuillez prendre une photo de votre ordonnance pour continuer."
        );
        setSubmitting(false);
        return;
      }

      // Vérifier que l'utilisateur est connecté
      const { data: userData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !userData.user) {
        Alert.alert(
          "Connexion requise",
          "Vous devez être connecté pour réserver un médicament.",
          [
            { text: "Annuler", style: "cancel" },
            { text: "Se connecter", onPress: () => router.push("/auth" as any) }
          ]
        );
        return;
      }

      const userId = userData.user.id;
      const deviceId = await getDeviceId();
      let prescriptionUrl = null;

      // 1. Upload prescription si elle existe
      if (prescriptionImage) {
        // Nettoyage de l'extension pour éviter les URLs de blob
        let fileExt = 'jpg';
        const parts = prescriptionImage.split('.');
        if (parts.length > 1) {
          const possibleExt = parts.pop()?.toLowerCase();
          if (possibleExt && possibleExt.length <= 4) {
            fileExt = possibleExt;
          }
        }
        
        const fileName = `${userId}_${Date.now()}.${fileExt}`;

        const response = await fetch(prescriptionImage);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('prescriptions')
          .upload(fileName, blob, {
            contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;
        prescriptionUrl = fileName;
      }

      // 2. Insérer la réservation avec user_id et device_id
      const { error: resError } = await supabase
        .from('reservations')
        .insert({
          device_id: deviceId,
          user_id: userId,
          pharmacy_id: item.id,
          medicine_id: selectedMedicine.id,
          quantity: quantity,
          prescription_url: prescriptionUrl,
          status: 'pending'
        });

      if (resError) throw resError;

      Alert.alert("Réservation envoyée ! ✅", "La pharmacie va examiner votre demande. Suivez l'avancement dans l'onglet \"Mes Réservations\".");
      setReservationModalVisible(false);
      resetReservationForm();
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetReservationForm = () => {
    setSelectedMedicine(null);
    setSelectedStock(0);
    setSearchQuery("");
    setSearchResults([]);
    setQuantity(1);
    setPrescriptionImage(null);
  };

  const services = useMemo(
    () => (item && Array.isArray(item.services_json) ? item.services_json : []),
    [item],
  );

  const hoursPretty = useMemo(
    () => (item ? formatHours(item.hours_json) : []),
    [item],
  );

  const openInfo = useMemo(() => {
    if (!item) return { open: false, label: "Horaires indisponibles" };
    return isOpenNow(item.hours_json, new Date());
  }, [item]);

  const destLat = lat ? Number(lat) : null;
  const destLng = lng ? Number(lng) : null;
  const canOpenMaps =
    destLat != null &&
    !Number.isNaN(destLat) &&
    destLng != null &&
    !Number.isNaN(destLng);

  if (error) {
    return (
      <View style={[UI.screen, { padding: Spacing.xl, gap: Spacing.lg, justifyContent: "center" }]}>
        <Text style={{ fontSize: 64, alignSelf: "center" }}>⚠️</Text>
        <Text style={{ fontSize: 24, fontWeight: "800", color: Palette.dangerText, textAlign: "center" }}>Détails inaccessibles</Text>
        <Text style={{ color: Palette.textSecondary, textAlign: "center", fontSize: 16 }}>{error}</Text>
        <Pressable
          onPress={() => router.back()}
          style={[UI.btnPrimary, { marginTop: Spacing.lg }]}
        >
          <Text style={Typography.button}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[UI.screen, { padding: Spacing.lg, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: Palette.textSecondary, fontWeight: "600" }}>Chargement des détails...</Text>
      </View>
    );
  }

  return (
    <View style={UI.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Header Block */}
        <View style={styles.headerBlock}>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.address}>
            {item.address ?? "Adresse indisponible"}
          </Text>

          {distanceKm ? (
            <View style={styles.distanceBadge}>
              <Text style={styles.distanceText}>📍 À {distanceKm} km</Text>
            </View>
          ) : null}
        </View>

        {/* Status Block */}
        <View
          style={[
            styles.statusBlock,
            openInfo.open ? styles.statusOpen : styles.statusClosed,
          ]}
        >
          <Text
            style={[
              styles.statusTitle,
              openInfo.open ? { color: Palette.successText } : { color: Palette.dangerText }
            ]}
          >
            {openInfo.open ? "🟢 Ouvert maintenant" : "🔴 Fermé maintenant"}
          </Text>
          <Text
            style={[
              styles.statusLabel,
              openInfo.open ? { color: Palette.successText } : { color: Palette.dangerText }
            ]}
          >
            {openInfo.label}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionGrid}>
          <Pressable
            onPress={toggleFavorite}
            disabled={favLoading}
            style={({ pressed }) => [
              styles.actionBtn,
              pressed && { backgroundColor: Palette.border },
              favLoading && { opacity: 0.6 }
            ]}
          >
            <Text style={styles.actionIcon}>{favorite ? "⭐" : "☆"}</Text>
            <Text style={styles.actionBtnText}>
              {favorite ? "Favori" : "Sauvegarder"}
            </Text>
          </Pressable>

          {item.phone ? (
            <Pressable
              onPress={() => Linking.openURL(`tel:${item.phone}`)}
              style={({ pressed }) => [
                styles.actionBtnDark,
                pressed && { opacity: 0.8 }
              ]}
            >
              <Text style={styles.actionIcon}>📞</Text>
              <Text style={styles.actionBtnTextLight}>Appeler</Text>
            </Pressable>
          ) : null}

          {canOpenMaps ? (
            <Pressable
              onPress={() =>
                openDirections(destLat!, destLng!, (name as string) ?? item.name)
              }
              style={({ pressed }) => [
                styles.actionBtnBorder,
                pressed && { backgroundColor: Palette.primaryLight }
              ]}
            >
              <Text style={styles.actionIcon}>🗺️</Text>
              <Text style={styles.actionBtnTextPrimary}>Y aller</Text>
            </Pressable>
          ) : null}
        </View>

        {/* CTA Réserver */}
        <Pressable
          onPress={() => setReservationModalVisible(true)}
          style={({ pressed }) => [
            styles.reserveBtn,
            pressed && { opacity: 0.9 }
          ]}>
          <Text style={styles.reserveBtnText}>Réserver (Click & Collect)</Text>
        </Pressable>

        {/* Services & Horaires Row */}
        <Text style={UI.sectionTitle}>Services</Text>
        <View style={styles.servicesBox}>
          {services.length ? (
            services.map((s: string) => (
              <View key={s} style={styles.serviceItem}>
                <Text style={styles.serviceDot}>•</Text>
                <Text style={styles.serviceText}>{s}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.serviceText}>Aucun service renseigné</Text>
          )}
        </View>

        <Text style={UI.sectionTitle}>Horaires</Text>
        <View style={styles.hoursBox}>
          {hoursPretty.length ? (
            hoursPretty.map((h, i) => (
              <View
                key={h.label}
                style={[
                  styles.hoursRow,
                  i < hoursPretty.length - 1 && styles.hoursRowBorder
                ]}
              >
                <Text style={styles.hoursKey}>{h.label}</Text>
                <Text style={styles.hoursValue}>{h.value}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.serviceText}>Horaires indisponibles</Text>
          )}
        </View>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { backgroundColor: Palette.border }
          ]}
        >
          <Text style={styles.backBtnText}>Retour</Text>
        </Pressable>

      </ScrollView>

      {/* Reservation Modal */}
      <Modal visible={reservationModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={Typography.h2}>Réserver un médicament</Text>
              <Pressable onPress={() => setReservationModalVisible(false)}>
                <Text style={styles.closeText}>Fermer</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {!selectedMedicine ? (
                <View style={styles.formSection}>
                  <Text style={styles.label}>Chercher votre médicament</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="ex: Doliprane 1000..."
                    value={searchQuery}
                    onChangeText={handleSearchMedicines}
                  />
                  {searching && <ActivityIndicator color={Palette.primary} />}
                  {searching ? null : searchResults.length === 0 && searchQuery.length >= 2 ? (
                    <View style={styles.emptySearchBox}>
                      <Text style={styles.emptySearchText}>😔 Ce médicament n'est pas disponible dans cette pharmacie.</Text>
                    </View>
                  ) : null}
                  <View style={styles.resultsList}>
                    {searchResults.map((stockItem: any) => (
                      <Pressable
                        key={stockItem.medicine?.id}
                        style={styles.resultItem}
                        onPress={() => {
                          setSelectedMedicine(stockItem.medicine);
                          setSelectedStock(stockItem.quantity);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.resultName}>{stockItem.medicine?.name}</Text>
                          <Text style={styles.resultStrength}>{stockItem.medicine?.strength || "-"}</Text>
                        </View>
                        <View style={styles.stockBadge}>
                          <Text style={styles.stockBadgeText}>{stockItem.quantity} en stock</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.formSection}>
                  <View style={styles.selectedMedCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectedMedName}>{selectedMedicine.name}</Text>
                      <Text style={styles.selectedMedStrength}>{selectedMedicine.strength}</Text>
                      {selectedStock > 0 && (
                        <Text style={styles.stockAvailable}>✅ {selectedStock} en stock</Text>
                      )}
                    </View>
                    <Pressable onPress={() => { setSelectedMedicine(null); setSelectedStock(0); }}>
                      <Text style={styles.changeText}>Modifier</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.label}>Quantité</Text>
                  <View style={styles.quantityRow}>
                    <Pressable
                      style={styles.qtyBtn}
                      onPress={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      <Text style={styles.qtyBtnText}>-</Text>
                    </Pressable>
                    <Text style={styles.qtyValue}>{quantity}</Text>
                    <Pressable
                      style={styles.qtyBtn}
                      onPress={() => setQuantity(quantity + 1)}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.label}>
                    Ordonnance {selectedMedicine.requires_prescription ? "(Obligatoire)" : "(Recommandé)"}
                  </Text>
                  {selectedMedicine.requires_prescription && (
                    <Text style={styles.mandatoryText}>⚠️ Ce médicament nécessite une ordonnance pour être validé par la pharmacie.</Text>
                  )}
                  <Pressable style={styles.uploadBtn} onPress={pickImage}>
                    <Text style={styles.uploadBtnText}>
                      {prescriptionImage ? "📷 Changer la photo" : "📷 Prendre une photo / Album"}
                    </Text>
                  </Pressable>
                  {prescriptionImage && (
                    <Image source={{ uri: prescriptionImage }} style={styles.previewImage} />
                  )}

                  <Pressable
                    style={[styles.confirmBtn, submitting && { opacity: 0.7 }]}
                    onPress={handleReserve}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.confirmBtnText}>Confirmer ma réservation</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  headerBlock: {
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: Palette.textPrimary,
    letterSpacing: -0.5,
  },
  address: {
    fontSize: 16,
    color: Palette.textSecondary,
    lineHeight: 22,
    marginTop: 4,
  },
  distanceBadge: {
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: "flex-start",
    marginTop: Spacing.sm,
  },
  distanceText: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  statusBlock: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  statusOpen: {
    borderColor: Palette.success,
    backgroundColor: Palette.successLight,
  },
  statusClosed: {
    borderColor: Palette.danger,
    backgroundColor: Palette.dangerLight,
  },
  statusTitle: {
    fontWeight: "800",
    fontSize: 15,
  },
  statusLabel: {
    opacity: 0.85,
    marginTop: 2,
    fontSize: 14,
    fontWeight: "500",
  },
  actionGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
    flexWrap: "wrap",
  },
  actionBtn: {
    flex: 1,
    minWidth: "30%",
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.borderStrong,
    alignItems: "center",
    ...Shadow.sm,
  },
  actionBtnDark: {
    flex: 1,
    minWidth: "30%",
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryDark,
    alignItems: "center",
    ...Shadow.sm,
  },
  actionBtnBorder: {
    flex: 1,
    minWidth: "30%",
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Palette.primary,
    alignItems: "center",
  },
  actionIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.textPrimary,
  },
  actionBtnTextLight: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.surface,
  },
  actionBtnTextPrimary: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.primary,
  },
  servicesBox: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
    marginBottom: Spacing.md,
  },
  serviceItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  serviceDot: {
    color: Palette.primary,
    fontSize: 18,
    lineHeight: 20,
    marginRight: 8,
  },
  serviceText: {
    fontSize: 15,
    color: Palette.textSecondary,
    lineHeight: 22,
    flex: 1,
  },
  hoursBox: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
    marginBottom: Spacing.xl,
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  hoursRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  hoursKey: {
    fontSize: 15,
    color: Palette.textSecondary,
  },
  hoursValue: {
    fontSize: 15,
    fontWeight: "600",
    color: Palette.textPrimary,
  },
  backBtn: {
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.borderStrong,
    alignItems: "center",
    ...Shadow.sm,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.textPrimary,
  },
  reserveBtn: {
    backgroundColor: Palette.primary,
    paddingVertical: 16,
    borderRadius: Radius.lg,
    alignItems: "center",
    marginBottom: Spacing.xl,
    ...Shadow.md,
  },
  reserveBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    height: '90%',
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  closeText: {
    color: Palette.textMuted,
    fontWeight: "600",
  },
  formSection: {
    marginVertical: Spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.textSecondary,
    marginBottom: 8,
    marginTop: 16,
  },
  searchInput: {
    backgroundColor: Palette.background,
    padding: 14,
    borderRadius: Radius.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Palette.borderStrong,
  },
  resultsList: {
    marginTop: 10,
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  resultName: {
    fontSize: 15,
    fontWeight: "600",
  },
  resultStrength: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  selectedMedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.primaryLight,
    padding: 16,
    borderRadius: Radius.md,
  },
  selectedMedName: {
    fontSize: 17,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  selectedMedStrength: {
    fontSize: 14,
    color: Palette.primaryDark,
    opacity: 0.7,
  },
  changeText: {
    color: Palette.primary,
    fontWeight: "700",
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginTop: 10,
  },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Palette.borderStrong,
  },
  qtyBtnText: {
    fontSize: 24,
    fontWeight: "600",
  },
  qtyValue: {
    fontSize: 22,
    fontWeight: "800",
    minWidth: 30,
    textAlign: "center",
  },
  uploadBtn: {
    backgroundColor: Palette.background,
    padding: 16,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.primary,
    borderStyle: "dashed",
    alignItems: "center",
    marginTop: 10,
  },
  uploadBtnText: {
    color: Palette.primary,
    fontWeight: "600",
  },
  previewImage: {
    width: "100%",
    height: 150,
    borderRadius: Radius.md,
    marginTop: 10,
    resizeMode: "cover",
  },
  mandatoryText: {
    fontSize: 12,
    color: Palette.dangerText,
    fontWeight: "600",
    marginBottom: 8,
  },
  confirmBtn: {
    backgroundColor: Palette.primary,
    padding: 18,
    borderRadius: Radius.md,
    alignItems: "center",
    marginTop: Spacing.xl,
    ...Shadow.md,
  },
  confirmBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  emptySearchBox: {
    backgroundColor: Palette.dangerLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  emptySearchText: {
    color: Palette.dangerText,
    fontSize: 14,
    fontWeight: "500",
  },
  stockBadge: {
    backgroundColor: Palette.successLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: "center",
  },
  stockBadgeText: {
    color: Palette.successText,
    fontSize: 12,
    fontWeight: "700",
  },
  stockAvailable: {
    fontSize: 13,
    color: Palette.successText,
    fontWeight: "600",
    marginTop: 4,
  },
});
