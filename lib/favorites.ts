import { supabase } from "./supabase";
import { getDeviceId } from "./device";

export type FavoritePharmacy = {
  pharmacy_id: string;
  created_at: string;
  pharmacy: {
    id: string;
    name: string;
    address: string | null;
    lat: number;
    lng: number;
    phone: string | null;
    hours_json: any;
    services_json: any;
  };
};

/** Récupère le user_id de l'utilisateur connecté */
async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Utilisateur non connecté");
  return data.user.id;
}

export async function isFavorite(pharmacyId: string): Promise<boolean> {
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("pharmacy_id", pharmacyId)
    .maybeSingle();

  if (error) {
    console.error("isFavorite error:", error);
    throw error;
  }
  return !!data;
}

export async function addFavorite(pharmacyId: string) {
  const userId = await getUserId();
  const deviceId = await getDeviceId();

  const { data, error } = await supabase.from("favorites").insert({
    user_id: userId,
    device_id: deviceId,
    pharmacy_id: pharmacyId,
  }).select();

  if (error) {
    console.error("addFavorite error:", error);
    throw error;
  }
  
  if (!data || data.length === 0) {
    throw new Error("Insert succeeded but returned no data (possible RLS issue)");
  }
}

export async function removeFavorite(pharmacyId: string) {
  const userId = await getUserId();

  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("pharmacy_id", pharmacyId);

  if (error) throw error;
}

export async function listFavorites(): Promise<FavoritePharmacy[]> {
  const userId = await getUserId();

  // join pharmacies
  const { data, error } = await supabase
    .from("favorites")
    .select(
      "pharmacy_id, created_at, pharmacy:pharmacies(id,name,address,lat,lng,phone,hours_json,services_json)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as any;
}
