import { supabase } from "./supabaseClient";
import * as SecureStore from "expo-secure-store";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";

const DEVICE_TOKEN_KEY = "device_token";

export async function getDeviceToken(): Promise<string | null> {
  return SecureStore.getItemAsync(DEVICE_TOKEN_KEY);
}

export async function setDeviceToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, token);
}

export async function clearDeviceToken(): Promise<void> {
  await SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY);
}

export default async function apiFetch(path: string, options: RequestInit = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const deviceToken = await getDeviceToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(deviceToken && { "X-Device-Token": deviceToken }),
    ...(options.headers as Record<string, string>),
  };

  const url = `${API_BASE}${path}`;
  console.log(`[apiFetch] ${options.method || "GET"} ${url} | token: ${token ? "yes" : "no"} | deviceToken: ${deviceToken ? "yes" : "no"}`);

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const json = await res.json();

  if (!res.ok) {
    console.error(`[apiFetch] FAILED ${res.status} ${path}:`, json.error);
    throw new Error(json.error || `Request failed with status ${res.status}`);
  }

  return json;
}
