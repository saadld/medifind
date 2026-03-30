import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "medifind_search_history_v1";
const MAX = 30;

export type HistoryItem = {
  query: string;
  at: string; // ISO date
};

export async function getHistory(): Promise<HistoryItem[]> {
  const raw = await AsyncStorage.getItem(KEY);
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

  const current = await getHistory();

  // évite les doublons consécutifs (ou même doublons tout court)
  const filtered = current.filter(
    (x) => x.query.toLowerCase() !== q.toLowerCase(),
  );

  const next: HistoryItem[] = [
    { query: q, at: new Date().toISOString() },
    ...filtered,
  ].slice(0, MAX);

  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export async function removeFromHistory(at: string): Promise<HistoryItem[]> {
  const current = await getHistory();
  const next = current.filter((x) => x.at !== at);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
