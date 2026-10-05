const KEY = 'anthropic_api_key';

type SecureStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

let cached: SecureStore | null | undefined;

function store(): SecureStore | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-secure-store') as SecureStore;
  } catch {
    console.warn('[fleur] expo-secure-store is not linked, rebuild to use the AI second opinion');
    cached = null;
  }
  return cached;
}

export function secureStoreAvailable(): boolean {
  return store() !== null;
}

export async function getApiKey(): Promise<string | null> {
  try {
    const value = await store()?.getItemAsync(KEY);
    return value?.trim() ? value.trim() : null;
  } catch (error) {
    console.warn('[fleur] could not read the stored API key', error);
    return null;
  }
}

export async function saveApiKey(key: string): Promise<boolean> {
  const s = store();
  if (!s) return false;
  try {
    await s.setItemAsync(KEY, key.trim());
    return true;
  } catch (error) {
    console.warn('[fleur] could not save the API key', error);
    return false;
  }
}

export async function forgetApiKey(): Promise<void> {
  try {
    await store()?.deleteItemAsync(KEY);
  } catch (error) {
    console.warn('[fleur] could not clear the API key', error);
  }
}
