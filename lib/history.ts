import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

const KEY_PREFIX = "medifind_search_history_";
const MAX = 30;

export type HistoryItem = {
  query: string;
  at: string; // ISO date
};

/** Retourne la clé AsyncStorage propre à l'utilisateur connecté */
async function getUserKey(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const userId = data?.user?.id ?? "anonymous";
  return `${KEY_PREFIX}${userId}`;
}

export async function getHistory(): Promise<HistoryItem[]> {
  const key = await getUserKey();
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

export async function addToHistory(query: string): Promise<HistoryItem[]> {
  const q = query.trim();
  if (!q) return getHistory();

  const key = await getUserKey();
  const current = await getHistory();

  // évite les doublons consécutifs (ou même doublons tout court)
  const filtered = current.filter(
    (x) => x.query.toLowerCase() !== q.toLowerCase(),
  );

  const next: HistoryItem[] = [
    { query: q, at: new Date().toISOString() },
    ...filtered,
  ].slice(0, MAX);

  await AsyncStorage.setItem(key, JSON.stringify(next));
  return next;
}

export async function clearHistory(): Promise<void> {
  const key = await getUserKey();
  await AsyncStorage.removeItem(key);
}

export async function removeFromHistory(at: string): Promise<HistoryItem[]> {
  const key = await getUserKey();
  const current = await getHistory();
  const next = current.filter((x) => x.at !== at);
  await AsyncStorage.setItem(key, JSON.stringify(next));
  return next;
}
