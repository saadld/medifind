import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "../../components/ui/icon-symbol";
import { Palette, Radius, Shadow, Spacing, Typography, UI } from "../../constants/theme";
import { supabase } from "../../lib/supabase";

/** Récupère le user_id de l'utilisateur connecté */
async function getUserId(): Promise<string> {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Utilisateur non connecté");
    return data.user.id;
}

type Reminder = {
    id: string;
    medicine_name: string;
    dosage: string;
    times_per_day: string[];
    is_active: boolean;
};

export default function TreatmentsScreen() {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalVisible, setModalVisible] = useState(false);

    // Form states
    const [newName, setNewName] = useState("");
    const [newDosage, setNewDosage] = useState("");
    const [newTimes, setNewTimes] = useState<string>("08:00"); // Simple string for now, could be improved

    const fetchReminders = async () => {
        try {
            setLoading(true);
            const userId = await getUserId();
            const { data, error } = await supabase
                .from("pill_reminders")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching reminders", error);
            } else {
                setReminders(data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchReminders();
        }, [])
    );

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from("pill_reminders")
                .update({ is_active: !currentStatus })
                .eq("id", id);
            if (!error) {
                setReminders((prev) =>
                    prev.map((r) => (r.id === id ? { ...r, is_active: !currentStatus } : r))
                );
            }
        } catch (err) {
            console.error(err);
        }
    };

    const deleteReminder = async (id: string) => {
        Alert.alert("Supprimer", "Voulez-vous supprimer ce traitement ?", [
            { text: "Annuler", style: "cancel" },
            {
                text: "Supprimer",
                style: "destructive",
                onPress: async () => {
                    await supabase.from("pill_reminders").delete().eq("id", id);
                    fetchReminders();
                },
            },
        ]);
    };

    const saveReminder = async () => {
        if (!newName.trim()) {
            Alert.alert("Erreur", "Le nom du médicament est obligatoire.");
            return;
        }

        try {
            const userId = await getUserId();
            const timesArray = newTimes.split(",").map(t => t.trim());

            const { error } = await supabase.from("pill_reminders").insert({
                user_id: userId,
                medicine_name: newName,
                dosage: newDosage,
                times_per_day: timesArray,
            });

            if (error) throw error;

            setModalVisible(false);
            setNewName("");
            setNewDosage("");
            setNewTimes("08:00");
            fetchReminders();
        } catch (e: any) {
            Alert.alert("Erreur", "Impossible de sauvegarder le traitement.");
        }
    };

    const renderItem = ({ item }: { item: Reminder }) => (
        <View style={[UI.card, styles.reminderCard, !item.is_active && styles.inactiveCard]}>
            <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                    <Text style={[styles.medicineName, !item.is_active && styles.inactiveText]}>
                        {item.medicine_name}
                    </Text>
                    {!!item.dosage && (
                        <Text style={[styles.dosageText, !item.is_active && styles.inactiveText]}>
                            {item.dosage}
                        </Text>
                    )}
                </View>
                <Pressable
                    onPress={() => toggleStatus(item.id, item.is_active)}
                    style={[styles.statusBadge, item.is_active ? styles.badgeActive : styles.badgeInactive]}
                >
                    <Text style={[styles.badgeText, item.is_active ? styles.badgeTextActive : styles.badgeTextInactive]}>
                        {item.is_active ? "En cours" : "Arrêté"}
                    </Text>
                </Pressable>
            </View>

            <View style={styles.cardFooter}>
                <View style={styles.timesContainer}>
                    <IconSymbol name="clock.fill" size={16} color={Palette.textMuted} />
                    <Text style={styles.timesText}>{item.times_per_day.join(" - ")}</Text>
                </View>
                <Pressable onPress={() => deleteReminder(item.id)} style={styles.deleteBtn}>
                    <IconSymbol name="trash.fill" size={18} color={Palette.dangerText} />
                </Pressable>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={UI.screen} edges={["top"]}>
            <View style={styles.header}>
                <Text style={Typography.h1}>💊 Pilulier</Text>
                <Text style={styles.subtitle}>Gérez vos traitements et prises</Text>
            </View>

            {loading ? (
                <View style={[UI.screen, { justifyContent: "center", alignItems: "center" }]}>
                    <ActivityIndicator size="large" color={Palette.primary} />
                </View>
            ) : (
                <FlatList
                    data={reminders}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>Aucun traitement enregistré.</Text>
                        </View>
                    }
                />
            )}

            {/* Floating Action Button */}
            <Pressable
                style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
                onPress={() => setModalVisible(true)}
            >
                <Text style={styles.fabIcon}>+</Text>
            </Pressable>

            {/* Add Reminder Modal */}
            <Modal visible={isModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={Typography.h2}>Nouveau Traitement</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Médicament *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ex: Doliprane"
                                value={newName}
                                onChangeText={setNewName}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Dosage</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ex: 1000mg"
                                value={newDosage}
                                onChangeText={setNewDosage}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Heures de prise</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ex: 08:00, 20:00"
                                value={newTimes}
                                onChangeText={setNewTimes}
                            />
                            <Text style={styles.helperText}>Séparées par des virgules</Text>
                        </View>

                        <View style={styles.modalActions}>
                            <Pressable
                                style={[styles.modalBtn, styles.modalBtnCancel]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelText}>Annuler</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.modalBtn, styles.modalBtnSave]}
                                onPress={saveReminder}
                            >
                                <Text style={styles.saveText}>Enregistrer</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        padding: Spacing.lg,
        backgroundColor: Palette.surface,
        borderBottomWidth: 1,
        borderBottomColor: Palette.border,
    },
    subtitle: {
        fontSize: 16,
        color: Palette.textSecondary,
        marginTop: 4,
    },
    list: {
        padding: Spacing.md,
        gap: Spacing.md,
        paddingBottom: 100, // Space for FAB
    },
    reminderCard: {
        padding: Spacing.md,
    },
    inactiveCard: {
        opacity: 0.6,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: Spacing.md,
    },
    headerLeft: {
        flex: 1,
    },
    medicineName: {
        fontSize: 18,
        fontWeight: "700",
        color: Palette.textSecondary,
        marginBottom: 2,
    },
    dosageText: {
        fontSize: 14,
        color: Palette.textSecondary,
    },
    inactiveText: {
        textDecorationLine: "line-through",
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: Radius.full,
    },
    badgeActive: {
        backgroundColor: Palette.primaryLight,
    },
    badgeInactive: {
        backgroundColor: Palette.border,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: "600",
    },
    badgeTextActive: {
        color: Palette.primaryDark,
    },
    badgeTextInactive: {
        color: Palette.textMuted,
    },
    cardFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Palette.border,
    },
    timesContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    timesText: {
        fontSize: 14,
        fontWeight: "500",
        color: Palette.textSecondary,
    },
    deleteBtn: {
        padding: 8,
    },
    emptyState: {
        padding: Spacing.xl,
        alignItems: "center",
    },
    emptyText: {
        color: Palette.textMuted,
        fontSize: 16,
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
        fontWeight: "300",
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
        ...Shadow.lg,
    },
    inputGroup: {
        marginTop: Spacing.lg,
    },
    label: {
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
        backgroundColor: Palette.background,
    },
    helperText: {
        fontSize: 12,
        color: Palette.textMuted,
        marginTop: 4,
    },
    modalActions: {
        flexDirection: "row",
        gap: Spacing.md,
        marginTop: Spacing.xl,
        marginBottom: Platform.OS === "ios" ? 20 : 0,
    },
    modalBtn: {
        flex: 1,
        padding: 14,
        borderRadius: Radius.md,
        alignItems: "center",
    },
    modalBtnCancel: {
        backgroundColor: Palette.background,
        borderWidth: 1,
        borderColor: Palette.borderStrong,
    },
    modalBtnSave: {
        backgroundColor: Palette.primary,
    },
    cancelText: {
        fontSize: 16,
        fontWeight: "600",
        color: Palette.textSecondary,
    },
    saveText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#FFFFFF",
    },
});
