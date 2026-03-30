import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Palette, Radius, Shadow, Spacing } from "../constants/theme";
import { supabase } from "../lib/supabase";

type AuthMode = "login" | "signup";

export default function AuthScreen() {
    const [mode, setMode] = useState<AuthMode>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("Erreur", "Veuillez remplir tous les champs.");
            return;
        }

        Keyboard.dismiss();
        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (error) throw error;
            if (!data.user) throw new Error("Erreur inattendue");

            // La redirection est gérée automatiquement par _layout.tsx
            // via onAuthStateChange
        } catch (e: any) {
            const msg = e.message || "";
            if (msg.includes("Invalid login credentials")) {
                Alert.alert("Erreur", "Email ou mot de passe incorrect.");
            } else if (msg.includes("Email not confirmed")) {
                Alert.alert("Compte non confirmé", "Vérifiez votre boîte mail pour confirmer votre compte.");
            } else if (msg.includes("rate limit")) {
                Alert.alert("Trop de tentatives", "Attendez quelques secondes avant de réessayer.");
            } else {
                Alert.alert("Erreur de connexion", msg || "Identifiants incorrects.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async () => {
        if (!email || !password || !confirmPassword) {
            Alert.alert("Erreur", "Veuillez remplir tous les champs.");
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert("Erreur", "Les mots de passe ne correspondent pas.");
            return;
        }
        if (password.length < 6) {
            Alert.alert("Erreur", "Le mot de passe doit contenir au moins 6 caractères.");
            return;
        }

        Keyboard.dismiss();
        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    data: {
                        full_name: fullName.trim() || undefined,
                    },
                },
            });

            if (error) throw error;

            if (data.session) {
                // Session directe (email confirmation désactivée) → _layout redirige
            } else {
                // Email de confirmation envoyé
                Alert.alert(
                    "Compte créé ! ✅",
                    "Un email de confirmation a été envoyé. Confirmez votre compte puis connectez-vous.",
                    [{ text: "OK", onPress: () => setMode("login") }]
                );
            }
        } catch (e: any) {
            const msg = e.message || "";
            if (msg.includes("already registered") || msg.includes("already exists")) {
                Alert.alert("Email déjà utilisé", "Cet email est déjà associé à un compte. Connectez-vous.");
            } else {
                Alert.alert("Erreur d'inscription", msg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <SafeAreaView style={styles.screen}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.logoBadge}>
                        <Text style={styles.logoEmoji}>💊</Text>
                    </View>
                    <Text style={styles.appName}>MediFind</Text>
                    <Text style={styles.tagline}>Votre pharmacie à portée de main</Text>
                </View>

                {/* Mode Toggle */}
                <View style={styles.toggleRow}>
                    <Pressable
                        style={[styles.toggleBtn, mode === "login" && styles.toggleBtnActive]}
                        onPress={() => setMode("login")}
                    >
                        <Text style={[styles.toggleText, mode === "login" && styles.toggleTextActive]}>
                            Connexion
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.toggleBtn, mode === "signup" && styles.toggleBtnActive]}
                        onPress={() => setMode("signup")}
                    >
                        <Text style={[styles.toggleText, mode === "signup" && styles.toggleTextActive]}>
                            Créer un compte
                        </Text>
                    </Pressable>
                </View>

                {/* Form */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        contentContainerStyle={styles.formScroll}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.card}>
                            {mode === "signup" && (
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Prénom et Nom (optionnel)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={fullName}
                                        onChangeText={setFullName}
                                        placeholder="ex: Ahmed Benali"
                                        autoCapitalize="words"
                                        autoCorrect={false}
                                    />
                                </View>
                            )}

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Adresse Email</Text>
                                <TextInput
                                    style={styles.input}
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder="email@exemple.com"
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    autoCorrect={false}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Mot de passe</Text>
                                <TextInput
                                    style={styles.input}
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="••••••••"
                                    secureTextEntry
                                />
                            </View>

                            {mode === "signup" && (
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Confirmer le mot de passe</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        placeholder="••••••••"
                                        secureTextEntry
                                    />
                                </View>
                            )}

                            <Pressable
                                style={({ pressed }) => [
                                    styles.btn,
                                    pressed && styles.btnPressed,
                                    loading && styles.btnDisabled,
                                ]}
                                onPress={mode === "login" ? handleLogin : handleSignup}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.btnText}>
                                        {mode === "login" ? "Se connecter" : "Créer mon compte"}
                                    </Text>
                                )}
                            </Pressable>

                            {mode === "login" && (
                                <View style={styles.infoBox}>
                                    <Text style={styles.infoText}>
                                        🩺 Pharmaciens : connectez-vous avec votre compte professionnel.
                                    </Text>
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: Palette.background,
    },
    header: {
        alignItems: "center",
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.lg,
        gap: Spacing.xs,
    },
    logoBadge: {
        width: 72,
        height: 72,
        borderRadius: 22,
        backgroundColor: Palette.primaryLight,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: Spacing.sm,
        ...Shadow.md,
    },
    logoEmoji: {
        fontSize: 36,
    },
    appName: {
        fontSize: 30,
        fontWeight: "900",
        color: Palette.primary,
        letterSpacing: -0.5,
    },
    tagline: {
        fontSize: 14,
        color: Palette.textSecondary,
    },
    toggleRow: {
        flexDirection: "row",
        marginHorizontal: Spacing.lg,
        backgroundColor: Palette.surface,
        borderRadius: Radius.lg,
        padding: 4,
        borderWidth: 1,
        borderColor: Palette.border,
        marginBottom: Spacing.md,
    },
    toggleBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: "center",
        borderRadius: Radius.md,
    },
    toggleBtnActive: {
        backgroundColor: Palette.primary,
        ...Shadow.sm,
    },
    toggleText: {
        fontSize: 15,
        fontWeight: "700",
        color: Palette.textMuted,
    },
    toggleTextActive: {
        color: "#fff",
    },
    formScroll: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.xxl,
    },
    card: {
        backgroundColor: Palette.surface,
        borderRadius: Radius.xl,
        padding: Spacing.xl,
        borderWidth: 1,
        borderColor: Palette.border,
        ...Shadow.lg,
        gap: Spacing.xs,
    },
    inputGroup: {
        marginBottom: Spacing.md,
    },
    label: {
        fontSize: 13,
        fontWeight: "700",
        color: Palette.textSecondary,
        marginBottom: Spacing.xs,
    },
    input: {
        borderWidth: 1,
        borderColor: Palette.borderStrong,
        borderRadius: Radius.md,
        padding: 14,
        fontSize: 16,
        backgroundColor: Palette.background,
        color: Palette.textPrimary,
    },
    btn: {
        backgroundColor: Palette.primary,
        padding: 16,
        borderRadius: Radius.md,
        alignItems: "center",
        marginTop: Spacing.sm,
        ...Shadow.md,
    },
    btnPressed: { opacity: 0.85 },
    btnDisabled: { opacity: 0.5 },
    btnText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
    },
    infoBox: {
        marginTop: Spacing.md,
        backgroundColor: Palette.primaryLight,
        borderRadius: Radius.md,
        padding: Spacing.md,
    },
    infoText: {
        color: Palette.primaryDark,
        fontSize: 13,
        fontWeight: "500",
        lineHeight: 20,
    },
});
