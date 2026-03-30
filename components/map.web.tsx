import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Palette } from '../constants/theme';

export default function AppMap({
    userLoc,
    items,
    onMarkerPress
}: {
    userLoc: { lat: number, lng: number };
    items: any[];
    onMarkerPress: (item: any) => void;
}) {
    return (
        <View style={[StyleSheet.absoluteFillObject, styles.fallbackContainer]}>
            <Text style={styles.fallbackText}>
                🗺️ La carte interactive n'est disponible que sur l'application mobile (iOS & Android).
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    fallbackContainer: {
        backgroundColor: Palette.surface,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    fallbackText: {
        fontSize: 16,
        color: Palette.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    }
});
