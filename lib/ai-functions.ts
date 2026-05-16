import { supabase } from "./supabase";

export async function searchPharmacies({ query, isOnCall }: { query?: string; isOnCall?: boolean }) {
  try {
    let request = supabase.from("pharmacies").select("*").limit(10);
    
    if (query) {
      request = request.ilike("name", `%${query}%`);
    }
    if (isOnCall) {
      request = request.eq("is_on_call", true);
    }

    const { data, error } = await request;

    if (error) throw error;
    
    return {
      success: true,
      data: data.map(p => ({
        name: p.name,
        address: p.address,
        phone: p.phone,
        isOnCall: p.is_on_call,
      }))
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function checkMedicineStock({ medicineName }: { medicineName: string }) {
  try {
    // 1. Trouver le médicament
    const { data: meds, error: medError } = await supabase
      .from("medicines")
      .select("id, name, form, strength")
      .ilike("name", `%${medicineName}%`)
      .limit(3);

    if (medError) throw medError;
    if (!meds || meds.length === 0) return { success: false, message: "Médicament non trouvé" };

    const firstMed = meds[0];

    // 2. Trouver le stock dans les pharmacies
    const { data: stocks, error: stockError } = await supabase
      .from("stocks")
      .select(`
        quantity,
        pharmacies(name, address, phone, is_on_call)
      `)
      .eq("medicine_id", firstMed.id)
      .gt("quantity", 0)
      .limit(5);

    if (stockError) throw stockError;

    return {
      success: true,
      medicine: firstMed,
      stocks: stocks?.map((s: any) => ({
        quantity: s.quantity,
        pharmacyName: s.pharmacies?.name,
        pharmacyAddress: s.pharmacies?.address,
        pharmacyPhone: s.pharmacies?.phone,
        isOnCall: s.pharmacies?.is_on_call
      }))
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
