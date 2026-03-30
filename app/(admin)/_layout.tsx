import { Stack, router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Palette, Radius, Spacing } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

export default function AdminLayout() {
    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.replace("/auth");
    };

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: Palette.primary,
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
            }}
        >
            <Stack.Screen
                name="index"
                options={{
                    title: 'Gestion Pharmacies',
                    headerBackVisible: false,
                    headerRight: () => (
                        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
                            <Text style={styles.logoutText}>Déconnexion</Text>
                        </Pressable>
                    ),
                }}
            />
        </Stack>
    );
}

const styles = StyleSheet.create({
    logoutBtn: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: Radius.full,
    },
    logoutText: {
        fontSize: 12,
        fontWeight: "700",
        color: '#fff',
    },
});
