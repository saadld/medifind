import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "../../components/ui/icon-symbol";
import { Palette, Radius, Shadow, Spacing, UI } from "../../constants/theme";
import { supabase } from "../../lib/supabase";

type Pharmacy = {
    id: string;
    name: string;
    address: string;
    user_id: string | null;
    created_at: string;
    lat?: number;
    lng?: number;
    phone: string | null;
    hours_json: any;
    services_json: any;
};

export default function AdminDashboard() {
    const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state (Add/Edit)
    const [modalVisible, setModalVisible] = useState(false);
    const [editingPharmacy, setEditingPharmacy] = useState<Pharmacy | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        address: "",
        lat: "",
        lng: "",
        phone: "",
        hours: "", // Will be stored as JSON
        services: "", // Will be stored as JSON
    });

    // Modal state (Account Access)
    const [accessModalVisible, setAccessModalVisible] = useState(false);
    const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);
    const [accessData, setAccessData] = useState({
        email: "",
        password: "",
    });

    const [saving, setSaving] = useState(false);

    const fetchPharmacies = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("pharmacies")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setPharmacies(data || []);
        } catch (e: any) {
            Alert.alert("Erreur", e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPharmacies();
    }, []);

    const openModal = (pharmacy?: Pharmacy) => {
        if (pharmacy) {
            setEditingPharmacy(pharmacy);
            setFormData({
                name: pharmacy.name,
                address: pharmacy.address || "",
                lat: String(pharmacy.lat ?? ""),
                lng: String(pharmacy.lng ?? ""),
                phone: pharmacy.phone || "",
                hours: pharmacy.hours_json ? JSON.stringify(pharmacy.hours_json) : "",
                services: pharmacy.services_json ? pharmacy.services_json.join(", ") : "",
            });
        } else {
            setEditingPharmacy(null);
            setFormData({ name: "", address: "", lat: "", lng: "", phone: "", hours: "", services: "" });
        }
        setModalVisible(true);
    };

    const handleGeocode = async (address: string) => {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
                { headers: { 'User-Agent': 'MediFindApp/1.0' } }
            );
            const data = await response.json();
            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon)
                };
            }
        } catch (e) {
            console.error("Geocoding error:", e);
        }
        return null;
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            Alert.alert("Erreur", "Le nom est obligatoire.");
            return;
        }

        try {
            setSaving(true);

            let finalLat = parseFloat(formData.lat);
            let finalLng = parseFloat(formData.lng);

            // Si lat/lng sont vides ou 0, on tente le geocoding auto
            if ((!finalLat || !finalLng) && formData.address.trim()) {
                const coords = await handleGeocode(formData.address);
                if (coords) {
                    finalLat = coords.lat;
                    finalLng = coords.lng;
                }
            }

            const payload = {
                name: formData.name.trim(),
                address: formData.address.trim(),
                lat: finalLat || 0,
                lng: finalLng || 0,
                phone: formData.phone.trim() || null,
                services_json: formData.services ? formData.services.split(",").map(s => s.trim()).filter(s => s) : null,
                hours_json: formData.hours.trim() || null, // Storing as string or JSON
            };

            if (editingPharmacy) {
                const { error } = await supabase
                    .from("pharmacies")
                    .update(payload)
                    .eq("id", editingPharmacy.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("pharmacies")
                    .insert([payload]);
                if (error) throw error;
            }

            setModalVisible(false);
            fetchPharmacies();
        } catch (e: any) {
            Alert.alert("Erreur", e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        Alert.alert(
            "Supprimer",
            "Voulez-vous vraiment supprimer cette pharmacie ?",
            [
                { text: "Annuler", style: "cancel" },
                {
                    text: "Supprimer",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const { error } = await supabase.from("pharmacies").delete().eq("id", id);
                            if (error) throw error;
                            fetchPharmacies();
                        } catch (e: any) {
                            Alert.alert("Erreur", e.message);
                        }
                    }
                }
            ]
        );
    };

    const openAccessModal = (pharmacyId: string) => {
        setSelectedPharmacyId(pharmacyId);
        setAccessData({ email: "", password: "" });
        setAccessModalVisible(true);
    };

    const handleCreateAccount = async () => {
        if (!accessData.email || !accessData.password) {
            Alert.alert("Erreur", "Email et mot de passe requis.");
            return;
        }

        try {
            setSaving(true);

            // Récupérer la session et l'anon key
            const { data: { session } } = await supabase.auth.getSession();

            console.log("🔍 Diagnostic Auth:");
            console.log("- Session active:", !!session);
            console.log("- Token présent:", !!session?.access_token);

            if (!session) throw new Error("Session expirée. Déconnectez-vous et reconnectez-vous.");

            // Appel à l'Edge Function Supabase
            const { data, error } = await supabase.functions.invoke('create-pharmacy-user', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: {
                    email: accessData.email.trim(),
                    password: accessData.password,
                    pharmacyId: selectedPharmacyId
                }
            });

            if (error) {
                console.error("Détails Erreur Edge Function:", error);
                throw error;
            }

            Alert.alert("Succès", "Compte créé et lié à la pharmacie !");
            setAccessModalVisible(false);
            fetchPharmacies();
        } catch (e: any) {
            console.error("Catch handleCreateAccount:", e);
            Alert.alert(
                "Erreur de création",
                `Type: ${e.name || 'Inconnu'}\nMessage: ${e.message}\n\nAssurez-vous que l'Edge Function est bien déployée sur Supabase.`
            );
        } finally {
            setSaving(false);
        }
    };

    const renderItem = ({ item }: { item: Pharmacy }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.pharmacyName}>{item.name}</Text>
                <View style={[styles.statusBadge, item.user_id ? styles.badgeActive : styles.badgePending]}>
                    <Text style={[styles.badgeText, item.user_id ? styles.badgeTextActive : styles.badgeTextPending]}>
                        {item.user_id ? "Compte Lié" : "Sans Compte"}
                    </Text>
                </View>
            </View>
            <Text style={styles.addressText} numberOfLines={2}>
                {item.address || "Adresse non renseignée"}
            </Text>

            <View style={styles.actionsBox}>
                <Pressable style={styles.actionBtn} onPress={() => openModal(item)}>
                    <IconSymbol name="pencil" size={16} color={Palette.primaryDark} />
                    <Text style={styles.actionText}>Modifier</Text>
                </Pressable>

                <Pressable style={[styles.actionBtn, { marginLeft: Spacing.md }]} onPress={() => handleDelete(item.id)}>
                    <IconSymbol name="trash" size={16} color={Palette.dangerText} />
                    <Text style={[styles.actionText, { color: Palette.dangerText }]}>Supprimer</Text>
                </Pressable>

                {!item.user_id && (
                    <Pressable style={[styles.actionBtn, { marginLeft: "auto" }]} onPress={() => openAccessModal(item.id)}>
                        <IconSymbol name="link" size={16} color={Palette.success} />
                        <Text style={[styles.actionText, { color: Palette.success }]}>Accès</Text>
                    </Pressable>
                )}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={UI.screen} edges={["top", "bottom", "left", "right"]}>
            {loading ? (
                <View style={UI.centered}>
                    <ActivityIndicator size="large" color={Palette.primary} />
                </View>
            ) : (
                <FlatList
                    data={pharmacies}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <View style={UI.centered}>
                            <Text style={{ color: Palette.textMuted }}>Aucune pharmacie enregistrée.</Text>
                        </View>
                    }
                />
            )}

            <Pressable
                style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
                onPress={() => openModal()}
            >
                <Text style={styles.fabIcon}>+</Text>
            </Pressable>

            {/* Modal de création/édition */}
            <Modal visible={modalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>
                            {editingPharmacy ? "Modifier la pharmacie" : "Ajouter une pharmacie"}
                        </Text>

                        <ScrollView style={styles.modalForm}>
                            <Text style={styles.inputLabel}>Nom de la pharmacie</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.name}
                                onChangeText={(t) => setFormData({ ...formData, name: t })}
                                placeholder="Pharmacie du Centre"
                            />

                            <Text style={styles.inputLabel}>Adresse complète</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.address}
                                onChangeText={(t) => setFormData({ ...formData, address: t })}
                                placeholder="123 rue de la Paix, Paris"
                                multiline
                            />

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                                    <Text style={styles.inputLabel}>Latitude</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.lat}
                                        onChangeText={(t) => setFormData({ ...formData, lat: t })}
                                        keyboardType="numeric"
                                        placeholder="48.85"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Longitude</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.lng}
                                        onChangeText={(t) => setFormData({ ...formData, lng: t })}
                                        keyboardType="numeric"
                                        placeholder="2.35"
                                    />
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Téléphone</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.phone}
                                onChangeText={(t) => setFormData({ ...formData, phone: t })}
                                placeholder="01 02 03 04 05"
                                keyboardType="phone-pad"
                            />

                            <Text style={styles.inputLabel}>Services (séparés par des virgules)</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.services}
                                onChangeText={(t) => setFormData({ ...formData, services: t })}
                                placeholder="Vaccination, Tests COVID, Orthopédie"
                            />

                            <Text style={styles.inputLabel}>Horaires (Texte libre)</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.hours}
                                onChangeText={(t) => setFormData({ ...formData, hours: t })}
                                placeholder="ex: Lun-Ven: 09:00-19:00, Sam: 09:00-12:00"
                                multiline
                            />
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <Pressable style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelBtnText}>Annuler</Text>
                            </Pressable>
                            <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal d'accès (Création de compte) */}
            <Modal visible={accessModalVisible} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Créer un accès pharmacien</Text>

                        <View style={styles.modalForm}>
                            <Text style={styles.inputLabel}>Email de connexion</Text>
                            <TextInput
                                style={styles.input}
                                value={accessData.email}
                                onChangeText={(t) => setAccessData({ ...accessData, email: t })}
                                placeholder="contact@pharmacie.com"
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />

                            <Text style={styles.inputLabel}>Mot de passe provisoire</Text>
                            <TextInput
                                style={styles.input}
                                value={accessData.password}
                                onChangeText={(t) => setAccessData({ ...accessData, password: t })}
                                placeholder="Min. 6 caractères"
                                secureTextEntry
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <Pressable style={styles.cancelBtn} onPress={() => setAccessModalVisible(false)}>
                                <Text style={styles.cancelBtnText}>Annuler</Text>
                            </Pressable>
                            <Pressable style={styles.saveBtn} onPress={handleCreateAccount} disabled={saving}>
                                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Créer le compte</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    list: {
        padding: Spacing.md,
        gap: Spacing.md,
        paddingBottom: 100,
    },
    card: {
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        ...Shadow.sm,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: Spacing.sm,
    },
    pharmacyName: {
        fontSize: 18,
        fontWeight: "700",
        color: Palette.textPrimary,
        flex: 1,
        marginRight: Spacing.sm,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: Radius.sm,
    },
    badgeActive: {
        backgroundColor: Palette.primaryLight,
    },
    badgePending: {
        backgroundColor: "#FEE2E2",
    },
    badgeText: {
        fontSize: 12,
        fontWeight: "700",
    },
    badgeTextActive: {
        color: Palette.primaryDark,
    },
    badgeTextPending: {
        color: "#991B1B",
    },
    addressText: {
        fontSize: 14,
        color: Palette.textSecondary,
        marginBottom: Spacing.md,
    },
    actionsBox: {
        flexDirection: "row",
        alignItems: "center",
        borderTopWidth: 1,
        borderTopColor: Palette.border,
        paddingTop: Spacing.md,
    },
    actionBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        padding: 6,
        backgroundColor: Palette.background,
        borderRadius: Radius.sm,
    },
    actionText: {
        fontSize: 13,
        fontWeight: "600",
        color: Palette.primaryDark,
    },
    fab: {
        position: "absolute",
        bottom: Spacing.xl,
        right: Spacing.lg,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Palette.primary,
        alignItems: "center",
        justifyContent: "center",
        ...Shadow.lg,
    },
    fabPressed: {
        opacity: 0.8,
    },
    fabIcon: {
        fontSize: 32,
        color: "#FFFFFF",
        lineHeight: 36,
    },
    // Modal styles
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
        height: '90%'
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "800",
        color: Palette.textPrimary,
        marginBottom: Spacing.xl,
    },
    modalForm: {
        marginBottom: Spacing.xl,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: "600",
        color: Palette.textSecondary,
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: Palette.borderStrong,
        borderRadius: Radius.md,
        padding: 12,
        fontSize: 16,
        marginBottom: Spacing.lg,
        color: Palette.textPrimary,
    },
    row: {
        flexDirection: "row",
    },
    modalActions: {
        flexDirection: "row",
        gap: Spacing.md,
    },
    cancelBtn: {
        flex: 1,
        padding: 16,
        borderRadius: Radius.md,
        alignItems: "center",
        borderWidth: 1,
        borderColor: Palette.borderStrong,
    },
    cancelBtnText: {
        fontSize: 16,
        fontWeight: "600",
        color: Palette.textSecondary,
    },
    saveBtn: {
        flex: 2,
        padding: 16,
        borderRadius: Radius.md,
        alignItems: "center",
        backgroundColor: Palette.primary,
    },
    saveBtnText: {
        fontSize: 16,
        fontWeight: "700",
        color: "#fff",
    },
});
