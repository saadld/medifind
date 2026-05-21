import { useFocusEffect } from "expo-router";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
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
import { getDeviceId } from "../../lib/device";

// ── Notification configuration ────────────────────────────────────────────────
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

async function requestNotificationPermission(): Promise<boolean> {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
}

/** 
 * Planifie les notifications. Si daysOfWeek contient les 7 jours, fait du DAILY.
 * Sinon, fait du WEEKLY pour chaque jour de la semaine sélectionné.
 */
async function scheduleReminderNotifications(
    medicineName: string,
    dosage: string,
    hour: number,
    minute: number,
    daysOfWeek: number[]
): Promise<string[]> {
    const ids: string[] = [];
    const content = {
        title: `💊 ${medicineName}`,
        body: dosage ? `Dosage : ${dosage}` : "N'oubliez pas votre médicament !",
        sound: true,
    };

    if (daysOfWeek.length === 7) {
        // Tous les jours = Daily
        const id = await Notifications.scheduleNotificationAsync({
            content,
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour,
                minute,
            },
        });
        ids.push(id);
    } else {
        // Jours spécifiques = Weekly trigger pour chaque jour
        for (const day of daysOfWeek) {
            const id = await Notifications.scheduleNotificationAsync({
                content,
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                    weekday: day,
                    hour,
                    minute,
                },
            });
            ids.push(id);
        }
    }
    return ids;
}

/** Stocke les IDs de notification localement par reminder ID */
const NOTIF_STORAGE_KEY = "medifind_notif_ids";

async function saveNotifIds(reminderId: string, ids: string[]) {
    const raw = await AsyncStorage.getItem(NOTIF_STORAGE_KEY);
    const map: Record<string, string[]> = raw ? JSON.parse(raw) : {};
    // Ajoute aux ids existants sans écraser si on met à jour
    const existing = map[reminderId] || [];
    map[reminderId] = [...existing, ...ids];
    await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(map));
}

async function getNotifIds(reminderId: string): Promise<string[]> {
    const raw = await AsyncStorage.getItem(NOTIF_STORAGE_KEY);
    if (!raw) return [];
    const map: Record<string, string[]> = JSON.parse(raw);
    return map[reminderId] ?? [];
}

async function removeNotifIds(reminderId: string) {
    const raw = await AsyncStorage.getItem(NOTIF_STORAGE_KEY);
    if (!raw) return;
    const map: Record<string, string[]> = JSON.parse(raw);
    delete map[reminderId];
    await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(map));
}

async function cancelNotificationsFor(reminderId: string) {
    const ids = await getNotifIds(reminderId);
    for (const id of ids) {
        try { await Notifications.cancelScheduledNotificationAsync(id); } catch (_) {}
    }
    await removeNotifIds(reminderId);
}

// ── Types ─────────────────────────────────────────────────────────────────────
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
    days_of_week?: number[];
    is_active: boolean;
};

// L, M, M, J, V, S, D => en expo-notifications, 1 = Dimanche, 2 = Lundi... 7 = Samedi.
const DAYS = [
    { label: "L", value: 2 },
    { label: "M", value: 3 },
    { label: "M", value: 4 },
    { label: "J", value: 5 },
    { label: "V", value: 6 },
    { label: "S", value: 7 },
    { label: "D", value: 1 },
];

function formatDaysLabel(days: number[]) {
    if (!days || days.length === 0 || days.length === 7) return "Tous les jours";
    if (days.length === 2 && days.includes(1) && days.includes(7)) return "Week-ends";
    if (days.length === 5 && !days.includes(1) && !days.includes(7)) return "En semaine";
    
    // Sort logic to match standard L, M, M, J, V, S, D
    const sorted = [...days].sort((a, b) => {
        const aVal = a === 1 ? 8 : a;
        const bVal = b === 1 ? 8 : b;
        return aVal - bVal;
    });
    
    return sorted.map(d => DAYS.find(x => x.value === d)?.label).join(", ");
}

// ── Simple +/- Time Picker ────────────────────────────────────────────────────
function TimeSpinner({
    value,
    max,
    onChange,
    label,
}: {
    value: number;
    max: number;
    onChange: (v: number) => void;
    label: string;
}) {
    const increment = () => onChange((value + 1) % (max + 1));
    const decrement = () => onChange((value - 1 + max + 1) % (max + 1));

    return (
        <View style={spinnerStyles.container}>
            <Text style={spinnerStyles.label}>{label}</Text>
            <Pressable onPress={increment} style={spinnerStyles.btn}>
                <Text style={spinnerStyles.arrow}>▲</Text>
            </Pressable>
            <View style={spinnerStyles.valueBox}>
                <Text style={spinnerStyles.value}>
                    {String(value).padStart(2, "0")}
                </Text>
            </View>
            <Pressable onPress={decrement} style={spinnerStyles.btn}>
                <Text style={spinnerStyles.arrow}>▼</Text>
            </Pressable>
        </View>
    );
}

const spinnerStyles = StyleSheet.create({
    container: { alignItems: "center", gap: 4 },
    label: {
        fontSize: 11, fontWeight: "700", color: Palette.textMuted,
        letterSpacing: 1, textTransform: "uppercase", marginBottom: 4,
    },
    btn: {
        width: 56, height: 42, borderRadius: Radius.md,
        backgroundColor: Palette.primaryLight, alignItems: "center", justifyContent: "center",
    },
    arrow: { fontSize: 18, color: Palette.primaryDark, fontWeight: "700" },
    valueBox: {
        width: 80, height: 64, borderRadius: Radius.md,
        backgroundColor: Palette.background, borderWidth: 2, borderColor: Palette.borderStrong,
        alignItems: "center", justifyContent: "center",
    },
    value: { fontSize: 36, fontWeight: "800", color: Palette.primaryDark, letterSpacing: 1 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function TreatmentsScreen() {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalVisible, setModalVisible] = useState(false);
    const [isTimePickerVisible, setTimePickerVisible] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newName, setNewName] = useState("");
    const [newDosage, setNewDosage] = useState("");
    const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
    const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
    
    // Time picker state
    const [pickerHour, setPickerHour] = useState(8);
    const [pickerMinute, setPickerMinute] = useState(0);

    useEffect(() => {
        requestNotificationPermission().then((granted) => {
            if (!granted) {
                Alert.alert(
                    "Notifications désactivées",
                    "Pour recevoir vos rappels de médicaments, activez les notifications dans Réglages > MediFind.",
                    [{ text: "OK" }]
                );
            }
        });
    }, []);

    const fetchReminders = async () => {
        try {
            setLoading(true);
            const userId = await getUserId();
            const { data, error } = await supabase
                .from("pill_reminders")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });

            if (error) console.error("Error fetching reminders", error);
            else setReminders(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchReminders(); }, []));

    // ── Open Modal (Create or Edit) ────────────────────────────────────────────
    const openModal = (item?: Reminder) => {
        if (item) {
            setEditingId(item.id);
            setNewName(item.medicine_name);
            setNewDosage(item.dosage || "");
            setSelectedTimes(item.times_per_day || []);
            setSelectedDays(item.days_of_week && item.days_of_week.length > 0 ? item.days_of_week : [1, 2, 3, 4, 5, 6, 7]);
        } else {
            setEditingId(null);
            setNewName("");
            setNewDosage("");
            setSelectedTimes([]);
            setSelectedDays([1, 2, 3, 4, 5, 6, 7]);
        }
        setPickerHour(8);
        setPickerMinute(0);
        setModalVisible(true);
    };

    const toggleDay = (val: number) => {
        setSelectedDays(prev => {
            if (prev.includes(val)) return prev.filter(d => d !== val);
            return [...prev, val];
        });
    };

    // ── Confirm time from picker ───────────────────────────────────────────────
    const confirmTime = () => {
        const h = String(pickerHour).padStart(2, "0");
        const m = String(pickerMinute).padStart(2, "0");
        const timeStr = `${h}:${m}`;
        setSelectedTimes((prev) => prev.includes(timeStr) ? prev : [...prev, timeStr].sort());
        setTimePickerVisible(false);
    };

    const removeTime = (t: string) => setSelectedTimes((prev) => prev.filter((x) => x !== t));

    // ── Save reminder + schedule notifications ─────────────────────────────────
    const saveReminder = async () => {
        if (!newName.trim()) {
            Alert.alert("Erreur", "Le nom du médicament est obligatoire.");
            return;
        }
        if (selectedTimes.length === 0) {
            Alert.alert("Erreur", "Ajoutez au moins une heure de prise.");
            return;
        }
        if (selectedDays.length === 0) {
            Alert.alert("Erreur", "Choisissez au moins un jour de rappel.");
            return;
        }

        try {
            setSaving(true);
            const userId = await getUserId();
            const deviceId = await getDeviceId();

            let finalReminderId = editingId;

            if (editingId) {
                // UPDATE
                await cancelNotificationsFor(editingId); // On annule les anciennes notifs
                const { error } = await supabase
                    .from("pill_reminders")
                    .update({
                        medicine_name: newName.trim(),
                        dosage: newDosage.trim(),
                        times_per_day: selectedTimes,
                        days_of_week: selectedDays,
                        is_active: true,
                    })
                    .eq("id", editingId);
                
                if (error) throw error;
            } else {
                // INSERT
                const { data, error } = await supabase
                    .from("pill_reminders")
                    .insert({
                        user_id: userId,
                        device_id: deviceId,
                        medicine_name: newName.trim(),
                        dosage: newDosage.trim(),
                        times_per_day: selectedTimes,
                        days_of_week: selectedDays,
                    })
                    .select()
                    .single();
                
                if (error) throw error;
                finalReminderId = data.id;
            }

            // Schedule new notifications
            const hasPermission = await requestNotificationPermission();
            if (hasPermission && finalReminderId) {
                let allNotifIds: string[] = [];
                for (const time of selectedTimes) {
                    const [h, m] = time.split(":").map(Number);
                    const generatedIds = await scheduleReminderNotifications(newName, newDosage, h, m, selectedDays);
                    allNotifIds = [...allNotifIds, ...generatedIds];
                }
                await saveNotifIds(finalReminderId, allNotifIds);
            }

            setModalVisible(false);
            fetchReminders();
        } catch (e: any) {
            Alert.alert("Erreur", "Impossible de sauvegarder le traitement.");
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    // ── Toggle active status ───────────────────────────────────────────────────
    const toggleStatus = async (item: Reminder) => {
        try {
            const becomingActive = !item.is_active;

            if (!becomingActive) {
                await cancelNotificationsFor(item.id);
            } else {
                const hasPermission = await requestNotificationPermission();
                if (hasPermission) {
                    let allNotifIds: string[] = [];
                    const days = item.days_of_week && item.days_of_week.length > 0 ? item.days_of_week : [1,2,3,4,5,6,7];
                    
                    for (const time of item.times_per_day) {
                        const [h, m] = time.split(":").map(Number);
                        const generatedIds = await scheduleReminderNotifications(item.medicine_name, item.dosage, h, m, days);
                        allNotifIds = [...allNotifIds, ...generatedIds];
                    }
                    await saveNotifIds(item.id, allNotifIds);
                }
            }

            const { error } = await supabase
                .from("pill_reminders")
                .update({ is_active: becomingActive })
                .eq("id", item.id);

            if (!error) {
                setReminders((prev) =>
                    prev.map((r) => (r.id === item.id ? { ...r, is_active: becomingActive } : r))
                );
            }
        } catch (err) {
            console.error(err);
        }
    };

    // ── Delete reminder ────────────────────────────────────────────────────────
    const deleteReminder = async (item: Reminder) => {
        Alert.alert("Supprimer", "Voulez-vous supprimer ce traitement ?", [
            { text: "Annuler", style: "cancel" },
            {
                text: "Supprimer",
                style: "destructive",
                onPress: async () => {
                    await cancelNotificationsFor(item.id);
                    await supabase.from("pill_reminders").delete().eq("id", item.id);
                    fetchReminders();
                },
            },
        ]);
    };

    // ── Render card ────────────────────────────────────────────────────────────
    const renderItem = ({ item }: { item: Reminder }) => {
        const daysLabel = formatDaysLabel(item.days_of_week || [1,2,3,4,5,6,7]);
        
        return (
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
                        onPress={() => toggleStatus(item)}
                        style={[
                            styles.statusBadge,
                            item.is_active ? styles.badgeActive : styles.badgeInactive,
                        ]}
                    >
                        <Text
                            style={[
                                styles.badgeText,
                                item.is_active ? styles.badgeTextActive : styles.badgeTextInactive,
                            ]}
                        >
                            {item.is_active ? "En cours" : "Arrêté"}
                        </Text>
                    </Pressable>
                </View>

                {/* Info: Days */}
                <View style={{ marginBottom: Spacing.sm }}>
                    <Text style={styles.daysInfoText}>📅 {daysLabel}</Text>
                </View>

                {/* Time badges */}
                <View style={styles.timesRow}>
                    {item.times_per_day.map((t) => (
                        <View key={t} style={styles.timeBadge}>
                            <IconSymbol name="clock.fill" size={12} color={Palette.primaryDark} />
                            <Text style={styles.timeBadgeText}>{t}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.cardFooter}>
                    <Text style={styles.notifHint}>
                        {item.is_active
                            ? "🔔 Rappels actifs"
                            : "🔕 Suspendu"}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pressable onPress={() => openModal(item)} style={styles.actionBtn}>
                            <IconSymbol name="pencil" size={18} color={Palette.textSecondary} />
                        </Pressable>
                        <Pressable onPress={() => deleteReminder(item)} style={styles.actionBtn}>
                            <IconSymbol name="trash.fill" size={18} color={Palette.dangerText} />
                        </Pressable>
                    </View>
                </View>
            </View>
        );
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={UI.screen} edges={["top"]}>
            <View style={styles.header}>
                <Text style={Typography.h1}>💊 Pilulier</Text>
                <Text style={styles.subtitle}>Gérez vos traitements et rappels</Text>
            </View>

            {loading ? (
                <View style={UI.centered}>
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
                            <Text style={styles.emptyIcon}>💊</Text>
                            <Text style={styles.emptyText}>Aucun traitement enregistré.</Text>
                            <Text style={styles.emptyHint}>
                                Appuyez sur + pour ajouter votre premier traitement.
                            </Text>
                        </View>
                    }
                />
            )}

            {/* FAB */}
            <Pressable
                style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
                onPress={() => openModal()}
            >
                <Text style={styles.fabIcon}>+</Text>
            </Pressable>

            {/* ── Modal (Add/Edit Reminder) ── */}
            <Modal visible={isModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHandle} />
                        <Text style={[Typography.h2, { marginBottom: Spacing.md }]}>
                            {editingId ? "Modifier le traitement" : "Nouveau Traitement"}
                        </Text>

                        {/* Médicament */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Médicament *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ex : Doliprane"
                                placeholderTextColor={Palette.textMuted}
                                value={newName}
                                onChangeText={setNewName}
                            />
                        </View>

                        {/* Dosage */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Dosage</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ex : 1000 mg"
                                placeholderTextColor={Palette.textMuted}
                                value={newDosage}
                                onChangeText={setNewDosage}
                            />
                        </View>

                        {/* Jours de prise */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Jours de rappel</Text>
                            <View style={styles.daysContainer}>
                                {DAYS.map((d) => {
                                    const isSelected = selectedDays.includes(d.value);
                                    return (
                                        <Pressable 
                                            key={d.value} 
                                            style={[styles.dayBubble, isSelected && styles.dayBubbleSelected]}
                                            onPress={() => toggleDay(d.value)}
                                        >
                                            <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                                                {d.label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Heures de prise */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Heures de prise</Text>
                            {selectedTimes.length > 0 && (
                                <View style={styles.timesBadgeRow}>
                                    {selectedTimes.map((t) => (
                                        <Pressable
                                            key={t}
                                            style={styles.timeChip}
                                            onPress={() => removeTime(t)}
                                        >
                                            <Text style={styles.timeChipText}>{t}</Text>
                                            <Text style={styles.timeChipRemove}>  ✕</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            )}
                            <Pressable
                                style={styles.addTimeBtn}
                                onPress={() => setTimePickerVisible(true)}
                            >
                                <IconSymbol name="clock.badge.plus" size={18} color={Palette.primary} />
                                <Text style={styles.addTimeBtnText}>Ajouter une heure</Text>
                            </Pressable>
                        </View>

                        <View style={styles.modalActions}>
                            <Pressable
                                style={[styles.modalBtn, styles.modalBtnCancel]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelText}>Annuler</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.modalBtn, styles.modalBtnSave, saving && { opacity: 0.7 }]}
                                onPress={saveReminder}
                                disabled={saving}
                            >
                                <Text style={styles.saveText}>
                                    {saving ? "Enregistrement…" : (editingId ? "Modifier" : "Enregistrer")}
                                </Text>
                            </Pressable>
                        </View>
                    </View>

                    {/* ── Time Picker Overlay (Inside Main Modal) ── */}
                    {isTimePickerVisible && (
                        <View style={[StyleSheet.absoluteFill, styles.timePickerOverlay]}>
                            <View style={styles.timePickerCard}>
                                <Text style={[Typography.h2, { textAlign: "center", marginBottom: Spacing.lg }]}>
                                    Choisir l'heure
                                </Text>

                                <View style={styles.timePickerWheels}>
                                    <TimeSpinner
                                        value={pickerHour}
                                        max={23}
                                        onChange={setPickerHour}
                                        label="Heure"
                                    />
                                    <Text style={styles.timeColon}>:</Text>
                                    <TimeSpinner
                                        value={pickerMinute}
                                        max={59}
                                        onChange={setPickerMinute}
                                        label="Minutes"
                                    />
                                </View>

                                <Text style={styles.timePreview}>
                                    {String(pickerHour).padStart(2, "0")}:{String(pickerMinute).padStart(2, "0")}
                                </Text>

                                <View style={styles.modalActions}>
                                    <Pressable
                                        style={[styles.modalBtn, styles.modalBtnCancel]}
                                        onPress={() => setTimePickerVisible(false)}
                                    >
                                        <Text style={styles.cancelText}>Annuler</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.modalBtn, styles.modalBtnSave]}
                                        onPress={confirmTime}
                                    >
                                        <Text style={styles.saveText}>Confirmer</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    header: { padding: Spacing.lg, backgroundColor: Palette.surface, borderBottomWidth: 1, borderBottomColor: Palette.border },
    subtitle: { fontSize: 16, color: Palette.textSecondary, marginTop: 4 },
    list: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 100 },
    reminderCard: { padding: Spacing.md },
    inactiveCard: { opacity: 0.55 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: Spacing.sm },
    headerLeft: { flex: 1 },
    medicineName: { fontSize: 18, fontWeight: "700", color: Palette.textPrimary, marginBottom: 2 },
    dosageText: { fontSize: 14, color: Palette.textSecondary },
    inactiveText: { textDecorationLine: "line-through", color: Palette.textMuted },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full },
    badgeActive: { backgroundColor: Palette.primaryLight },
    badgeInactive: { backgroundColor: Palette.border },
    badgeText: { fontSize: 12, fontWeight: "600" },
    badgeTextActive: { color: Palette.primaryDark },
    badgeTextInactive: { color: Palette.textMuted },
    daysInfoText: { fontSize: 13, color: Palette.textSecondary, fontWeight: "500" },
    timesRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.sm },
    timeBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Palette.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full },
    timeBadgeText: { fontSize: 13, fontWeight: "600", color: Palette.primaryDark },
    cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Palette.border, marginTop: Spacing.xs },
    notifHint: { fontSize: 12, color: Palette.textMuted },
    actionBtn: { padding: 8 },
    emptyState: { padding: Spacing.xl, alignItems: "center", gap: Spacing.sm },
    emptyIcon: { fontSize: 48, marginBottom: Spacing.sm },
    emptyText: { color: Palette.textSecondary, fontSize: 17, fontWeight: "600" },
    emptyHint: { color: Palette.textMuted, fontSize: 14, textAlign: "center" },
    fab: { position: "absolute", bottom: Spacing.xl, right: Spacing.lg, width: 60, height: 60, borderRadius: 30, backgroundColor: Palette.primary, alignItems: "center", justifyContent: "center", ...Shadow.lg },
    fabPressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
    fabIcon: { fontSize: 32, color: "#FFFFFF", lineHeight: 36, fontWeight: "300" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    modalContent: { backgroundColor: Palette.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, paddingBottom: Platform.OS === "ios" ? 36 : Spacing.xl, ...Shadow.lg },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Palette.border, alignSelf: "center", marginBottom: Spacing.md },
    inputGroup: { marginTop: Spacing.md },
    label: { fontSize: 12, fontWeight: "700", color: Palette.textSecondary, letterSpacing: 0.8, marginBottom: 8, textTransform: "uppercase" },
    input: { borderWidth: 1.5, borderColor: Palette.borderStrong, borderRadius: Radius.md, padding: 13, fontSize: 16, color: Palette.textPrimary, backgroundColor: Palette.background },
    
    daysContainer: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
    dayBubble: { width: 38, height: 38, borderRadius: 19, backgroundColor: Palette.background, borderWidth: 1.5, borderColor: Palette.borderStrong, alignItems: "center", justifyContent: "center" },
    dayBubbleSelected: { backgroundColor: Palette.primary, borderColor: Palette.primary },
    dayText: { fontSize: 13, fontWeight: "700", color: Palette.textSecondary },
    dayTextSelected: { color: "#FFF" },

    timesBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.sm },
    timeChip: { flexDirection: "row", alignItems: "center", backgroundColor: Palette.primaryLight, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1, borderColor: Palette.borderStrong },
    timeChipText: { fontSize: 15, fontWeight: "700", color: Palette.primaryDark },
    timeChipRemove: { fontSize: 11, color: Palette.primaryDark, fontWeight: "700" },
    addTimeBtn: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: 13, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Palette.borderStrong, borderStyle: "dashed", backgroundColor: Palette.background },
    addTimeBtnText: { fontSize: 15, color: Palette.primary, fontWeight: "600" },
    modalActions: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.xl },
    modalBtn: { flex: 1, padding: 15, borderRadius: Radius.md, alignItems: "center" },
    modalBtnCancel: { backgroundColor: Palette.background, borderWidth: 1.5, borderColor: Palette.borderStrong },
    modalBtnSave: { backgroundColor: Palette.primary, ...Shadow.md },
    cancelText: { fontSize: 16, fontWeight: "600", color: Palette.textSecondary },
    saveText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
    timePickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: Spacing.lg },
    timePickerCard: { backgroundColor: Palette.surface, borderRadius: Radius.xl, padding: Spacing.xl, width: "100%", maxWidth: 320, ...Shadow.lg },
    timePickerWheels: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, marginBottom: Spacing.md },
    timeColon: { fontSize: 36, fontWeight: "800", color: Palette.primaryDark, marginBottom: 8 },
    timePreview: { textAlign: "center", fontSize: 44, fontWeight: "800", color: Palette.primary, letterSpacing: 3, marginBottom: Spacing.lg },
});
