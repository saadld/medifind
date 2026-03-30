import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Palette, Radius, Shadow, Spacing } from "../../constants/theme";
import { supabase } from "../../lib/supabase";

type ReservationStatus = "pending" | "approved" | "ready" | "collected" | "rejected";

type Reservation = {
    id: string;
    status: ReservationStatus;
    quantity: number;
    created_at: string;
    prescription_url: string | null;
    medicine: { name: string; strength: string | null } | null;
    pharmacy: { name: string; address: string | null } | null;
};

const STATUS_STEPS: { key: ReservationStatus; label: string; icon: string }[] = [
    { key: "pending", label: "En attente", icon: "⏳" },
    { key: "approved", label: "Accepté", icon: "✅" },
    { key: "ready", label: "Prêt", icon: "🏪" },
    { key: "collected", label: "Récupéré", icon: "🎉" },
];

function getStepIndex(status: ReservationStatus): number {
    if (status === "rejected") return -1;
    return STATUS_STEPS.findIndex((s) => s.key === status);
}

function StatusTimeline({ status }: { status: ReservationStatus }) {
    if (status === "rejected") {
        return (
            <View style={timelineStyles.rejectedBox}>
                <Text style={timelineStyles.rejectedText}>❌ Demande refusée par la pharmacie</Text>
            </View>
        );
    }

    const currentIndex = getStepIndex(status);

    return (
        <View style={timelineStyles.row}>
            {STATUS_STEPS.map((step, index) => {
                const done = index <= currentIndex;
                const isLast = index === STATUS_STEPS.length - 1;

                return (
                    <View key={step.key} style={timelineStyles.stepWrapper}>
                        <View style={[timelineStyles.dot, done && timelineStyles.dotActive]}>
                            <Text style={timelineStyles.dotIcon}>{step.icon}</Text>
                        </View>
                        <Text style={[timelineStyles.stepLabel, done && timelineStyles.stepLabelActive]}>
                            {step.label}
                        </Text>
                        {!isLast && (
                            <View style={[timelineStyles.line, done && index < currentIndex && timelineStyles.lineDone]} />
                        )}
                    </View>
                );
            })}
        </View>
    );
}

export default function ReservationsScreen() {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadReservations = useCallback(async () => {
        try {
            const { data: userData, error: authErr } = await supabase.auth.getUser();
            if (authErr || !userData.user) {
                router.replace("/auth" as any);
                return;
            }

            const { data, error } = await supabase
                .from("reservations")
                .select(`
                    id, status, quantity, created_at, prescription_url,
                    medicine:medicines(name, strength),
                    pharmacy:pharmacies(name, address)
                `)
                .eq("user_id", userData.user.id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setReservations(data as any || []);
        } catch (e: any) {
            Alert.alert("Erreur", e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadReservations();
    }, [loadReservations]);

    const onRefresh = () => {
        setRefreshing(true);
        loadReservations();
    };

    const handleSignOut = () => {
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
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Palette.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Mes Réservations</Text>
                    <Text style={styles.headerSub}>{reservations.length} réservation{reservations.length !== 1 ? "s" : ""}</Text>
                </View>
                <Pressable onPress={handleSignOut} style={styles.signOutBtn}>
                    <Text style={styles.signOutText}>⎋ Déconnexion</Text>
                </Pressable>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />
                }
                showsVerticalScrollIndicator={false}
            >
                {reservations.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyEmoji}>📋</Text>
                        <Text style={styles.emptyTitle}>Aucune réservation</Text>
                        <Text style={styles.emptySub}>
                            Vos réservations Click & Collect apparaîtront ici.{"\n"}Cherchez une pharmacie pour commencer.
                        </Text>
                        <Pressable
                            style={styles.ctaBtn}
                            onPress={() => router.push("/(tabs)" as any)}
                        >
                            <Text style={styles.ctaBtnText}>🔍 Trouver une pharmacie</Text>
                        </Pressable>
                    </View>
                ) : (
                    reservations.map((res) => (
                        <View key={res.id} style={styles.card}>
                            {/* Médicament */}
                            <View style={styles.cardHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.medName}>{res.medicine?.name ?? "Médicament inconnu"}</Text>
                                    {res.medicine?.strength ? (
                                        <Text style={styles.medStrength}>{res.medicine.strength}</Text>
                                    ) : null}
                                </View>
                                <View style={styles.qtyBadge}>
                                    <Text style={styles.qtyText}>×{res.quantity}</Text>
                                </View>
                            </View>

                            {/* Pharmacie */}
                            <View style={styles.pharmacyRow}>
                                <Text style={styles.pharmacyIcon}>🏥</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.pharmacyName}>{res.pharmacy?.name ?? "Pharmacie"}</Text>
                                    {res.pharmacy?.address ? (
                                        <Text style={styles.pharmacyAddr}>{res.pharmacy.address}</Text>
                                    ) : null}
                                </View>
                                <Text style={styles.dateText}>
                                    {new Date(res.created_at).toLocaleDateString("fr-FR", {
                                        day: "2-digit",
                                        month: "short",
                                    })}
                                </Text>
                            </View>

                            {/* Timeline */}
                            <View style={styles.timelineContainer}>
                                <StatusTimeline status={res.status} />
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const timelineStyles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        position: "relative",
    },
    stepWrapper: {
        flex: 1,
        alignItems: "center",
        position: "relative",
    },
    dot: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Palette.border,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2,
    },
    dotActive: {
        backgroundColor: Palette.primaryLight,
        borderWidth: 2,
        borderColor: Palette.primary,
    },
    dotIcon: {
        fontSize: 16,
    },
    stepLabel: {
        fontSize: 10,
        fontWeight: "600",
        color: Palette.textMuted,
        textAlign: "center",
        marginTop: 4,
    },
    stepLabelActive: {
        color: Palette.primary,
        fontWeight: "800",
    },
    line: {
        position: "absolute",
        top: 18,
        right: "-50%",
        width: "100%",
        height: 2,
        backgroundColor: Palette.border,
        zIndex: 1,
    },
    lineDone: {
        backgroundColor: Palette.primary,
    },
    rejectedBox: {
        backgroundColor: Palette.dangerLight,
        borderRadius: Radius.md,
        padding: Spacing.md,
        alignItems: "center",
    },
    rejectedText: {
        color: Palette.dangerText,
        fontWeight: "700",
        fontSize: 14,
    },
});

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: Palette.background,
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: Palette.background,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        backgroundColor: Palette.surface,
        borderBottomWidth: 1,
        borderBottomColor: Palette.border,
        ...Shadow.sm,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: "900",
        color: Palette.textPrimary,
        letterSpacing: -0.3,
    },
    headerSub: {
        fontSize: 13,
        color: Palette.textMuted,
        marginTop: 2,
    },
    signOutBtn: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: Radius.md,
        backgroundColor: Palette.dangerLight,
    },
    signOutText: {
        fontSize: 13,
        fontWeight: "700",
        color: Palette.dangerText,
    },
    content: {
        padding: Spacing.md,
        paddingBottom: 100,
    },
    emptyBox: {
        alignItems: "center",
        paddingTop: 60,
        paddingHorizontal: Spacing.xl,
        gap: Spacing.md,
    },
    emptyEmoji: {
        fontSize: 56,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: "800",
        color: Palette.textPrimary,
    },
    emptySub: {
        fontSize: 15,
        color: Palette.textSecondary,
        textAlign: "center",
        lineHeight: 22,
    },
    ctaBtn: {
        marginTop: Spacing.md,
        backgroundColor: Palette.primary,
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: Radius.full,
        ...Shadow.md,
    },
    ctaBtnText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 15,
    },
    card: {
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Palette.border,
        ...Shadow.sm,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: Spacing.sm,
    },
    medName: {
        fontSize: 17,
        fontWeight: "800",
        color: Palette.textPrimary,
    },
    medStrength: {
        fontSize: 13,
        color: Palette.textMuted,
        marginTop: 2,
    },
    qtyBadge: {
        backgroundColor: Palette.primaryLight,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: Radius.full,
    },
    qtyText: {
        color: Palette.primaryDark,
        fontWeight: "800",
        fontSize: 14,
    },
    pharmacyRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Palette.border,
    },
    pharmacyIcon: {
        fontSize: 20,
    },
    pharmacyName: {
        fontSize: 14,
        fontWeight: "700",
        color: Palette.textSecondary,
    },
    pharmacyAddr: {
        fontSize: 12,
        color: Palette.textMuted,
        marginTop: 2,
    },
    dateText: {
        fontSize: 12,
        color: Palette.textMuted,
        fontWeight: "600",
    },
    timelineContainer: {
        marginTop: Spacing.sm,
    },
});
