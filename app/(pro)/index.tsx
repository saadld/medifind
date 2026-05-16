import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Palette, Radius, Shadow, Spacing, Typography, UI } from "../../constants/theme";
import { supabase } from "../../lib/supabase";

type Reservation = {
    id: string;
    medicine_id: string;
    quantity: number;
    status: string;
    created_at: string;
    prescription_url: string | null;
    medicine: {
        name: string;
        strength: string | null;
        requires_prescription: boolean;
    };
};

type StockItem = {
    medicine_id: string;
    quantity: number;
    medicine: {
        name: string;
        strength: string | null;
        requires_prescription: boolean;
    };
};

type GlobalMedicine = {
    id: string;
    name: string;
    strength: string | null;
    requires_prescription: boolean;
};

export default function ProDashboard() {
    const [tab, setTab] = useState<'reservations' | 'stock'>('reservations');
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [stock, setStock] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [pharmacyId, setPharmacyId] = useState<string | null>(null);
    const [pharmacyName, setPharmacyName] = useState("");

    // Medicine Search & Add states
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<GlobalMedicine[]>([]);
    const [searching, setSearching] = useState(false);

    // Form for new or existing medicine
    const [formName, setFormName] = useState("");
    const [formStrength, setFormStrength] = useState("");
    const [formQuantity, setFormQuantity] = useState("");
    const [formRequiresPrescription, setFormRequiresPrescription] = useState(false);
    const [selectedMedId, setSelectedMedId] = useState<string | null>(null);

    // Edit Stock state (simple quantity update)
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editQuantity, setEditQuantity] = useState("");
    const [editingStockMedId, setEditingStockMedId] = useState<string | null>(null);
    const [editingStockMedName, setEditingStockMedName] = useState("");

    // Prescription View state
    const [fullImageVisible, setFullImageVisible] = useState(false);
    const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);

    const loadData = async () => {
        try {
            setLoading(true);
            const { data: userResp, error: userErr } = await supabase.auth.getUser();
            if (userErr || !userResp.user) throw new Error("Non authentifié");

            const { data: pharm, error: pharmErr } = await supabase
                .from("pharmacies")
                .select("id, name")
                .eq("user_id", userResp.user.id)
                .single();

            if (pharmErr) throw pharmErr;
            setPharmacyId(pharm.id);
            setPharmacyName(pharm.name);

            if (tab === 'reservations') {
                const { data: resData, error: resErr } = await supabase
                    .from("reservations")
                    .select(`
                        id, quantity, status, created_at, prescription_url,
                        medicine:medicines(name, strength, requires_prescription)
                    `)
                    .eq("pharmacy_id", pharm.id)
                    .order("created_at", { ascending: false });

                if (resErr) throw resErr;
                setReservations(resData as any);
            } else {
                const { data: stockData, error: stockErr } = await supabase
                    .from("stocks")
                    .select(`
                        quantity, medicine_id,
                        medicine:medicines(name, strength, requires_prescription)
                    `)
                    .eq("pharmacy_id", pharm.id);

                if (stockErr) throw stockErr;
                setStock(stockData as any);
            }
        } catch (e: any) {
            Alert.alert("Erreur", e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [tab]);

    // --- Inventory Management Logic ---

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        setFormName(query); // Sync with name field
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const { data, error } = await supabase
                .from("medicines")
                .select("id, name, strength, requires_prescription")
                .ilike("name", `%${query}%`)
                .limit(5);
            if (error) throw error;
            setSearchResults(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setSearching(false);
        }
    };

    const handleSelectMedicine = (med: GlobalMedicine) => {
        setSelectedMedId(med.id);
        setFormName(med.name);
        setFormStrength(med.strength || "");
        setFormRequiresPrescription(med.requires_prescription || false);
        setSearchResults([]);
    };

    const handleSaveStock = async () => {
        if (!pharmacyId || !formName) {
            Alert.alert("Erreur", "Le nom du médicament est requis.");
            return;
        }

        try {
            setLoading(true);
            let medId = selectedMedId;

            // 1. If no selectedMedId, try to find by exact name/strength or create
            if (!medId) {
                const { data: existingMed, error: findErr } = await supabase
                    .from("medicines")
                    .select("id")
                    .eq("name", formName.trim())
                    .eq("strength", formStrength.trim())
                    .maybeSingle();

                if (findErr) throw findErr;

                if (existingMed) {
                    medId = existingMed.id;
                    // Update existing medicine's prescription status if needed
                    await supabase
                        .from("medicines")
                        .update({ requires_prescription: formRequiresPrescription })
                        .eq("id", medId);
                } else {
                    // Create NEW medicine
                    const { data: newMed, error: createErr } = await supabase
                        .from("medicines")
                        .insert({ 
                            name: formName.trim(), 
                            strength: formStrength.trim(),
                            requires_prescription: formRequiresPrescription 
                        })
                        .select()
                        .single();
                    if (createErr) throw createErr;
                    medId = newMed.id;
                }
            }

            // 2. Add or Update stock
            const qty = parseInt(formQuantity) || 0;
            const { data: existingStock, error: checkErr } = await supabase
                .from("stocks")
                .select("quantity")
                .eq("pharmacy_id", pharmacyId)
                .eq("medicine_id", medId)
                .maybeSingle();

            if (checkErr) throw checkErr;

            if (existingStock) {
                await supabase
                    .from("stocks")
                    .update({ quantity: qty })
                    .eq("pharmacy_id", pharmacyId)
                    .eq("medicine_id", medId);
            } else {
                await supabase
                    .from("stocks")
                    .insert({ pharmacy_id: pharmacyId, medicine_id: medId, quantity: qty });
            }

            setAddModalVisible(false);
            resetForm();
            loadData();
            Alert.alert("Succès", "Stock mis à jour !");
        } catch (e: any) {
            Alert.alert("Erreur", e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateQuantity = async () => {
        if (!pharmacyId || !editingStockMedId) return;
        try {
            setLoading(true);
            const { error } = await supabase
                .from("stocks")
                .update({ quantity: parseInt(editQuantity) || 0 })
                .eq("pharmacy_id", pharmacyId)
                .eq("medicine_id", editingStockMedId);

            if (error) throw error;
            setEditModalVisible(false);
            loadData();
        } catch (e: any) {
            Alert.alert("Erreur", e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteStock = (medicineId: string) => {
        Alert.alert("Supprimer", "Retirer ce médicament de votre inventaire ?", [
            { text: "Annuler", style: "cancel" },
            {
                text: "Supprimer",
                style: "destructive",
                onPress: async () => {
                    try {
                        setLoading(true);
                        await supabase
                            .from("stocks")
                            .delete()
                            .eq("pharmacy_id", pharmacyId)
                            .eq("medicine_id", medicineId);
                        loadData();
                    } catch (e: any) { Alert.alert("Erreur", e.message); }
                    finally { setLoading(false); }
                }
            }
        ]);
    };

    const resetForm = () => {
        setFormName("");
        setFormStrength("");
        setFormQuantity("");
        setFormRequiresPrescription(false);
        setSelectedMedId(null);
        setSearchQuery("");
        setSearchResults([]);
    };

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        try {
            setLoading(true);
            const { error } = await supabase
                .from("reservations")
                .update({ status: newStatus })
                .eq("id", id);
            if (error) throw error;
            loadData();
        } catch (e: any) {
            Alert.alert("Erreur", e.message);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return Palette.warning;
            case 'approved': return Palette.success;
            case 'ready': return Palette.primary;
            case 'collected': return Palette.textMuted;
            case 'rejected': return Palette.danger;
            default: return Palette.textSecondary;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'pending': return 'En attente';
            case 'approved': return 'Accepté';
            case 'ready': return 'Prêt';
            case 'collected': return 'Récupéré';
            case 'rejected': return 'Refusé';
            default: return status;
        }
    };

    // --- Renders ---

    const renderReservationItem = ({ item }: { item: Reservation }) => {
        const publicUrl = item.prescription_url
            ? supabase.storage.from('prescriptions').getPublicUrl(item.prescription_url).data.publicUrl
            : null;

        if (publicUrl) console.log("URL Ordonnance:", publicUrl);

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.medNameText}>{item.medicine?.name || "Inconnu"}</Text>
                        <Text style={styles.medStrengthText}>{item.medicine?.strength || "-"}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                        <Text style={[styles.statusBadgeText, { color: getStatusColor(item.status) }]}>
                            {getStatusText(item.status)}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardRow}>
                    <Text style={styles.labelSmall}>Quantité: <Text style={styles.valueText}>{item.quantity}</Text></Text>
                    <Text style={styles.labelSmall}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>

                {publicUrl && (
                    <View style={styles.prescriptionContainer}>
                        <Text style={styles.labelSmall}>Ordonnance :</Text>
                        <Pressable onPress={() => { setSelectedFullImage(publicUrl); setFullImageVisible(true); }}>
                            <Image source={{ uri: publicUrl }} style={styles.prescriptionThumb} />
                            <Text style={styles.zoomHint}>🔍 Cliquer pour agrandir</Text>
                        </Pressable>
                    </View>
                )}

                <View style={styles.actionRow}>
                    {item.status === 'pending' && (
                        <>
                            <Pressable
                                style={[styles.actionBtnSmall, { backgroundColor: Palette.success }]}
                                onPress={() => handleUpdateStatus(item.id, 'approved')}
                            >
                                <Text style={styles.actionBtnTextSmall}>Accepter</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.actionBtnSmall, { backgroundColor: Palette.danger }]}
                                onPress={() => handleUpdateStatus(item.id, 'rejected')}
                            >
                                <Text style={styles.actionBtnTextSmall}>Refuser</Text>
                            </Pressable>
                        </>
                    )}
                    {item.status === 'approved' && (
                        <Pressable
                            style={[styles.actionBtnSmall, { backgroundColor: Palette.primary }]}
                            onPress={() => handleUpdateStatus(item.id, 'ready')}
                        >
                            <Text style={styles.actionBtnTextSmall}>Marquer comme Prêt</Text>
                        </Pressable>
                    )}
                    {item.status === 'ready' && (
                        <Pressable
                            style={[styles.actionBtnSmall, { backgroundColor: Palette.textMuted }]}
                            onPress={() => handleUpdateStatus(item.id, 'collected')}
                        >
                            <Text style={styles.actionBtnTextSmall}>Marquer comme Récupéré</Text>
                        </Pressable>
                    )}
                </View>
            </View>
        );
    };

    const renderStockItem = ({ item }: { item: StockItem }) => (
        <View style={styles.card}>
            <View style={styles.stockInfo}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.medicineName}>{item.medicine?.name || "Inconnu"}</Text>
                    <Text style={styles.strengthText}>{item.medicine?.strength || "-"}</Text>
                </View>
                <View style={styles.quantityBadge}>
                    <Text style={styles.quantityText}>{item.quantity}</Text>
                </View>
            </View>
            {item.medicine?.requires_prescription && (
                <View style={styles.prescriptionBadge}>
                    <Text style={styles.prescriptionBadgeText}>📄 Ordonnance obligatoire</Text>
                </View>
            )}
            <View style={styles.actions}>
                <Pressable
                    onPress={() => {
                        setEditingStockMedId(item.medicine_id);
                        setEditingStockMedName(item.medicine?.name || "");
                        setEditQuantity(item.quantity.toString());
                        setEditModalVisible(true);
                    }}
                    style={[styles.btn, styles.editBtn]}
                >
                    <Text style={styles.btnText}>Modifier</Text>
                </Pressable>
                <Pressable onPress={() => handleDeleteStock(item.medicine_id)} style={styles.deleteBtn}>
                    <Text style={[styles.btnText, { color: Palette.dangerText, paddingHorizontal: 10 }]}>Retirer</Text>
                </Pressable>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={UI.screen} edges={["bottom", "left", "right"]}>
            <View style={styles.tabsContainer}>
                {(['reservations', 'stock'] as const).map((t) => (
                    <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.activeTab]}>
                        <Text style={[styles.tabText, tab === t && styles.activeTabText]}>
                            {t === 'reservations' ? 'Réservations' : 'Inventaire / Stock'}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {loading && !addModalVisible && !editModalVisible ? (
                <View style={UI.centered}><ActivityIndicator size="large" color={Palette.primary} /></View>
            ) : (
                <View style={{ flex: 1 }}>
                    <FlatList
                        data={tab === 'reservations' ? reservations : stock}
                        keyExtractor={(item: any) => item.id || item.medicine_id}
                        contentContainerStyle={styles.list}
                        renderItem={tab === 'reservations' ? renderReservationItem : (renderStockItem as any)}
                        ListEmptyComponent={<Text style={styles.emptyText}>Aucun élément à afficher.</Text>}
                    />
                    {tab === 'stock' && (
                        <Pressable style={styles.fab} onPress={() => { resetForm(); setAddModalVisible(true); }}>
                            <Text style={styles.fabText}>+ Ajouter un médicament au stock</Text>
                        </Pressable>
                    )}
                </View>
            )}

            {/* Modal AJOUTER */}
            <Modal visible={addModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={Typography.h2}>Ajouter au stock</Text>
                            <Pressable onPress={() => setAddModalVisible(false)}><Text style={styles.closeText}>Annuler</Text></Pressable>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Nom du médicament</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="ex: Doliprane"
                                    value={formName}
                                    onChangeText={handleSearch}
                                />
                                {searching && <ActivityIndicator style={styles.searchLoader} />}
                                {searchResults.length > 0 && (
                                    <View style={styles.suggestions}>
                                        {searchResults.map((med) => (
                                            <Pressable key={med.id} style={styles.suggestionItem} onPress={() => handleSelectMedicine(med)}>
                                                <Text style={styles.suggestionName}>{med.name} - <Text style={{ fontWeight: '400' }}>{med.strength}</Text></Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                )}
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Dosage / Forme (optionnel)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="ex: 1000mg, Gélules"
                                    value={formStrength}
                                    onChangeText={setFormStrength}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Quantité initiale</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0"
                                    value={formQuantity}
                                    onChangeText={setFormQuantity}
                                    keyboardType="numeric"
                                />
                            </View>

                            <View style={[styles.formGroup, styles.switchGroup]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Ordonnance obligatoire</Text>
                                    <Text style={styles.helperText}>Le client devra obligatoirement joindre une photo.</Text>
                                </View>
                                <Switch
                                    value={formRequiresPrescription}
                                    onValueChange={setFormRequiresPrescription}
                                    trackColor={{ false: Palette.border, true: Palette.primary }}
                                />
                            </View>

                            <Pressable style={UI.btnPrimary} onPress={handleSaveStock}>
                                <Text style={Typography.button}>Valider le stock</Text>
                            </Pressable>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Modal MODIFIER Quantité */}
            <Modal visible={editModalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: 'auto', paddingBottom: 40 }]}>
                        <Text style={Typography.h2}>Modifier le stock</Text>
                        <Text style={[Typography.body, { marginBottom: 20 }]}>{editingStockMedName}</Text>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Nouvelle quantité</Text>
                            <TextInput
                                style={styles.input}
                                value={editQuantity}
                                onChangeText={setEditQuantity}
                                keyboardType="numeric"
                                autoFocus
                            />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <Pressable style={[UI.btnOutline, { flex: 1 }]} onPress={() => setEditModalVisible(false)}>
                                <Text style={[Typography.button, { color: Palette.primary }]}>Annuler</Text>
                            </Pressable>
                            <Pressable style={[UI.btnPrimary, { flex: 1 }]} onPress={handleUpdateQuantity}>
                                <Text style={Typography.button}>Mettre à jour</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal IMAGE PLEIN ECRAN */}
            <Modal visible={fullImageVisible} transparent animationType="fade">
                <View style={styles.fullImageOverlay}>
                    <Pressable style={styles.fullImageClose} onPress={() => setFullImageVisible(false)}>
                        <Text style={styles.fullImageCloseText}>✕ Fermer</Text>
                    </Pressable>
                    {selectedFullImage && (
                        <Image source={{ uri: selectedFullImage }} style={styles.fullImage} />
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    tabsContainer: {
        flexDirection: "row",
        backgroundColor: Palette.surface,
        borderBottomWidth: 1,
        borderBottomColor: Palette.border,
    },
    tab: {
        flex: 1,
        paddingVertical: 15,
        alignItems: "center",
        borderBottomWidth: 3,
        borderBottomColor: "transparent",
    },
    activeTab: {
        borderBottomColor: Palette.primary,
    },
    tabText: {
        fontSize: 14,
        fontWeight: "600",
        color: Palette.textMuted,
    },
    activeTabText: {
        color: Palette.primary,
        fontWeight: "800",
    },
    list: {
        padding: Spacing.md,
        paddingBottom: 100,
    },
    card: {
        backgroundColor: Palette.surface,
        borderRadius: Radius.md,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        ...Shadow.sm,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    medNameText: {
        fontSize: 16,
        fontWeight: "700",
        color: Palette.textPrimary,
    },
    medStrengthText: {
        fontSize: 13,
        color: Palette.textMuted,
    },
    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: Radius.full,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    cardRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: Spacing.sm,
    },
    labelSmall: {
        fontSize: 12,
        color: Palette.textMuted,
        fontWeight: "600",
    },
    valueText: {
        color: Palette.textPrimary,
        fontWeight: "700",
    },
    prescriptionContainer: {
        marginTop: Spacing.md,
        padding: Spacing.sm,
        backgroundColor: Palette.background,
        borderRadius: Radius.sm,
        borderWidth: 1,
        borderColor: Palette.border,
    },
    prescriptionThumb: {
        width: "100%",
        height: 200,
        borderRadius: Radius.sm,
        marginTop: 6,
        backgroundColor: '#eee',
        resizeMode: "contain",
    },
    actionRow: {
        flexDirection: "row",
        gap: Spacing.sm,
        marginTop: Spacing.md,
    },
    actionBtnSmall: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: Radius.md,
        flex: 1,
        alignItems: "center",
    },
    actionBtnTextSmall: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "700",
    },
    stockInfo: {
        flexDirection: "row",
        alignItems: "center",
    },
    medicineName: {
        fontSize: 17,
        fontWeight: "800",
        color: Palette.textPrimary,
    },
    strengthText: {
        color: Palette.textMuted,
        fontSize: 14,
    },
    quantityBadge: {
        backgroundColor: Palette.primaryLight,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: Radius.full,
    },
    quantityText: {
        color: Palette.primaryDark,
        fontWeight: "800",
        fontSize: 15,
    },
    actions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: Spacing.md,
        gap: 12,
    },
    btn: {
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: Radius.sm,
    },
    editBtn: {
        backgroundColor: Palette.primary,
    },
    deleteBtn: {
        borderWidth: 1,
        borderColor: Palette.danger,
    },
    btnText: {
        color: "#fff",
        fontWeight: "700",
    },
    fab: {
        position: "absolute",
        bottom: 20,
        right: 20,
        left: 20,
        backgroundColor: Palette.primaryDark,
        paddingVertical: 16,
        borderRadius: Radius.lg,
        alignItems: "center",
        ...Shadow.md,
    },
    fabText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
    emptyText: {
        color: Palette.textMuted,
        textAlign: "center",
        marginTop: 40,
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
        marginBottom: Spacing.xl,
    },
    closeText: {
        color: Palette.textMuted,
        fontWeight: "600",
    },
    formGroup: {
        marginBottom: Spacing.lg,
    },
    label: {
        fontSize: 14,
        fontWeight: "700",
        color: Palette.textSecondary,
        marginBottom: 8,
    },
    input: {
        backgroundColor: Palette.background,
        padding: 14,
        borderRadius: Radius.sm,
        fontSize: 16,
        borderWidth: 1,
        borderColor: Palette.borderStrong,
    },
    suggestions: {
        backgroundColor: Palette.surface,
        marginTop: 5,
        borderRadius: Radius.sm,
        borderWidth: 1,
        borderColor: Palette.border,
        maxHeight: 200,
    },
    suggestionItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: Palette.border,
    },
    suggestionName: {
        fontSize: 15,
        fontWeight: "600",
        color: Palette.textPrimary,
    },
    searchLoader: {
        marginTop: 5,
    },
    switchGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Palette.background,
        padding: 12,
        borderRadius: Radius.sm,
        marginBottom: 20,
    },
    helperText: {
        fontSize: 12,
        color: Palette.textMuted,
    },
    prescriptionBadge: {
        backgroundColor: Palette.warning + '20',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: Radius.sm,
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    prescriptionBadgeText: {
        fontSize: 11,
        color: Palette.warning,
        fontWeight: '700',
    },
    zoomHint: {
        fontSize: 10,
        color: Palette.primary,
        textAlign: 'center',
        marginTop: 4,
        fontWeight: '600',
    },
    fullImageOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullImage: {
        width: '95%',
        height: '80%',
        resizeMode: 'contain',
    },
    fullImageClose: {
        position: 'absolute',
        top: 50,
        right: 20,
        padding: 10,
        zIndex: 10,
    },
    fullImageCloseText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
});
