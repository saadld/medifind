import * as ImagePicker from 'expo-image-picker';

export async function scanPrescription(): Promise<string[] | null> {
    // 1. Demander la permission d'accès à la caméra
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
        alert("Vous avez refusé d'autoriser l'accès à votre caméra !");
        return null;
    }

    // 2. Ouvrir la caméra
    const pickerResult = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.5,
        base64: true,
    });

    if (pickerResult.canceled || !pickerResult.assets[0].base64) {
        return null;
    }

    try {
        const formData = new FormData();
        formData.append('language', 'fre');
        formData.append('isOverlayRequired', 'false');
        formData.append('base64Image', `data:image/jpeg;base64,${pickerResult.assets[0].base64}`);

        // Appel à une API d'OCR gratuite (OCR.space)
        // Utilisation de la clé de test 'helloworld'
        const response = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            headers: {
                'apikey': 'helloworld',
            },
            body: formData,
        });

        const result = await response.json();

        if (result.ParsedResults && result.ParsedResults.length > 0) {
            const rawText = result.ParsedResults[0].ParsedText || "";
            // Nettoyage: séparer par les retours à la ligne, et garder ce qui ressemble à des mots
            const lines = rawText
                .split('\n')
                .map((l: string) => l.trim().replace(/\r/g, ''))
                .filter((l: string) => l.length > 3);

            if (lines.length > 0) {
                return lines;
            }
        }

        return ["Aucun texte trouvé"];
    } catch (e) {
        console.error("Erreur OCR:", e);
        return ["Erreur d'analyse"];
    }
}
