import * as ImagePicker from 'expo-image-picker';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function scanPrescription(): Promise<string[] | null> {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
        alert("Vous avez refusé d'autoriser l'accès à votre caméra !");
        return null;
    }

    const pickerResult = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.5,
        base64: true,
    });

    if (pickerResult.canceled || !pickerResult.assets[0].base64) {
        return null;
    }

    try {
        const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) {
            alert("Clé API Gemini non configurée !");
            return null;
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        // gemini-2.5-flash est parfait pour le traitement multimodal rapide
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = "Voici une ordonnance médicale ou une boîte de médicament. Extrais uniquement la liste des médicaments prescrits ou affichés sous forme d'une liste JSON de chaînes de caractères. Ne renvoie rien d'autre que le tableau JSON (exemple de réponse attendue: [\"Doliprane\", \"Spasfon\"]).";
        
        const imageParts = [
            {
                inlineData: {
                    data: pickerResult.assets[0].base64,
                    mimeType: 'image/jpeg'
                }
            }
        ];

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = result.response;
        const text = response.text();
        
        // Nettoyage pour extraire le JSON
        const jsonMatch = text.match(/\[.*\]/s);
        if (jsonMatch) {
            const meds = JSON.parse(jsonMatch[0]);
            if (Array.isArray(meds) && meds.length > 0) {
                return meds;
            }
        }

        return ["Aucun médicament clair trouvé"];
    } catch (e) {
        console.error("Erreur Gemini OCR:", e);
        return ["Erreur d'analyse d'image"];
    }
}
