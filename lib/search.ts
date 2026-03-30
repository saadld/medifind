import { haversineKm } from "../utils/distance";
import { supabase } from "./supabase";

export type PharmacyResult = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  hours_json: any;
  services_json: any;
  is_on_call: boolean;
  quantity: number;
  distanceKm: number;
};

/** Applique un filtre rapide sur une pharmacie */
export function applyFilter(p: PharmacyResult, filter: string): boolean {
  if (!filter || filter === "none") return true;
  const services: string[] = p.services_json || [];
  if (filter === "garde") return p.is_on_call === true;
  if (filter === "24h")
    return (
      p.hours_json?.mon_fri === "00:00-23:59" ||
      String(p.hours_json?.mon_fri).toLowerCase() === "24h/24" ||
      services.some((s) => s.toLowerCase().includes("24"))
    );
  if (filter === "vaccin")
    return services.some((s) => s.toLowerCase().includes("vaccin"));
  if (filter === "test")
    return services.some((s) => s.toLowerCase().includes("test"));
  return true;
}

/** Recherche médicament + filtre optionnel */
export async function searchMedicineAndNearbyPharmacies(
  query: string,
  userLat: number,
  userLng: number,
  filter?: string,
): Promise<{ medicineName: string | null; pharmacies: PharmacyResult[] }> {
  // 1) Chercher le médicament
  const { data: meds, error: medErr } = await supabase
    .from("medicines")
    .select("id,name")
    .ilike("name", `%${query}%`)
    .limit(1);

  if (medErr) throw medErr;

  const med = meds?.[0];
  if (!med) return { medicineName: null, pharmacies: [] };

  // 2) Récupérer stocks > 0 + join pharmacies
  const { data: rows, error: stockErr } = await supabase
    .from("stocks")
    .select(
      "quantity, pharmacy:pharmacies(id,name,address,lat,lng,phone,hours_json,services_json,is_on_call)",
    )
    .eq("medicine_id", med.id)
    .gt("quantity", 0);

  if (stockErr) throw stockErr;

  let pharmacies: PharmacyResult[] = (rows ?? []).map((r: any) => {
    const p = r.pharmacy;
    return {
      ...p,
      quantity: r.quantity,
      distanceKm: haversineKm(userLat, userLng, p.lat, p.lng),
    };
  });

  // 3) Appliquer filtre si présent
  if (filter && filter !== "none") {
    pharmacies = pharmacies.filter((p) => applyFilter(p, filter));
  }

  pharmacies.sort((a, b) => a.distanceKm - b.distanceKm);
  return { medicineName: med.name, pharmacies };
}

/** Recherche par filtre seul (sans médicament) — toutes les pharmacies proches */
export async function searchNearbyPharmaciesByFilter(
  userLat: number,
  userLng: number,
  filter: string,
): Promise<PharmacyResult[]> {
  const { data: rows, error } = await supabase
    .from("pharmacies")
    .select("id,name,address,lat,lng,phone,hours_json,services_json,is_on_call");

  if (error) throw error;

  let pharmacies: PharmacyResult[] = (rows ?? []).map((p: any) => ({
    ...p,
    quantity: 0,
    distanceKm: haversineKm(userLat, userLng, p.lat, p.lng),
  }));

  // Appliquer filtre
  if (filter && filter !== "none") {
    pharmacies = pharmacies.filter((p) => applyFilter(p, filter));
  }

  pharmacies.sort((a, b) => a.distanceKm - b.distanceKm);
  return pharmacies;
}
