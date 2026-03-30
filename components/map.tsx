import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
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
        <MapView
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_DEFAULT}
            initialRegion={{
                latitude: userLoc.lat,
                longitude: userLoc.lng,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            }}
        >
            <Marker
                coordinate={{ latitude: userLoc.lat, longitude: userLoc.lng }}
                pinColor={Palette.primary}
                title="Votre position"
            />

            {items.map((item) => (
                <Marker
                    key={item.id}
                    coordinate={{ latitude: Number(item.lat), longitude: Number(item.lng) }}
                    pinColor={item.quantity > 0 ? Palette.success : Palette.danger}
                    title={item.name}
                    description={`${item.quantity} en stock - ${item.distanceKm.toFixed(2)}km`}
                    onCalloutPress={() => onMarkerPress(item)}
                />
            ))}
        </MapView>
    );
}
