import { GoogleGenerativeAI, SchemaType, FunctionDeclaration } from "@google/generative-ai";
import { searchPharmacies, checkMedicineStock } from "./ai-functions";

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

const searchPharmaciesDeclaration: FunctionDeclaration = {
  name: "searchPharmacies",
  description: "Recherche des pharmacies dans la base de données selon un nom ou un critère (de garde, de nuit, 24/7).",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      query: { type: SchemaType.STRING, description: "Nom de la pharmacie ou texte de recherche" },
      isOnCall: { type: SchemaType.BOOLEAN, description: "Doit-être true si l'utilisateur demande une pharmacie de garde" },
    },
  },
};

const checkMedicineStockDeclaration: FunctionDeclaration = {
  name: "checkMedicineStock",
  description: "Cherche quelles pharmacies ont un médicament spécifique en stock.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      medicineName: { type: SchemaType.STRING, description: "Le nom du médicament (ex: Doliprane)" },
    },
    required: ["medicineName"],
  },
};

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash", // Use a good model for function calling
  systemInstruction: "Tu es MediFind Assistant, un assistant médical sympathique et professionnel aidant les utilisateurs à trouver des pharmacies et des médicaments. Utilise les outils fournis pour interroger la base de données. Sois concis. Formate tes réponses de manière lisible (retours à la ligne, listes). Tu parles français.",
  tools: [
    {
      functionDeclarations: [searchPharmaciesDeclaration, checkMedicineStockDeclaration],
    },
  ],
});

export const aiChatSession = model.startChat();

export async function processAIChat(userText: string, onUpdate: (text: string) => void) {
  if (!apiKey) {
    onUpdate("Erreur: Clé API Gemini manquante. Veuillez définir EXPO_PUBLIC_GEMINI_API_KEY dans le fichier .env.");
    return;
  }

  try {
    const result = await aiChatSession.sendMessage(userText);
    const response = result.response;
    let text = response.text();
    
    // Check if the model wants to call a function
    const calls = response.functionCalls();
    
    if (calls && calls.length > 0) {
      onUpdate("Recherche dans la base de données... ⏳");
      
      const functionResponses = [];
      
      for (const call of calls) {
        let apiResponse;
        
        if (call.name === "searchPharmacies") {
          const args = call.args as { query?: string; isOnCall?: boolean };
          apiResponse = await searchPharmacies(args);
        } else if (call.name === "checkMedicineStock") {
          const args = call.args as { medicineName: string };
          apiResponse = await checkMedicineStock(args);
        } else {
          apiResponse = { error: "Unknown function" };
        }
        
        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: apiResponse
          }
        });
      }
      
      // Sending back the result of the functions to the model
      const secondResult = await aiChatSession.sendMessage(functionResponses);
      text = secondResult.response.text();
    }
    
    onUpdate(text);
    return;
  } catch (error: any) {
    console.error("AI Error:", error);
    onUpdate("Désolé, une erreur s'est produite lors de la communication avec l'assistant. " + error.message);
  }
}
