import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "medifind_device_id_v1";

function uuidv4() {
  // UUID simple sans dépendances externes
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEY);
  if (existing) return existing;

  const id = uuidv4();
  await AsyncStorage.setItem(KEY, id);
  return id;
}
