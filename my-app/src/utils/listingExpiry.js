import { supabase } from "../supabaseClient";

const EXPIRATION_DAYS = 10;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export async function removeExpiredUnresolvedListings() {
  const cutoffIso = new Date(Date.now() - EXPIRATION_DAYS * DAY_IN_MS).toISOString();

  const { data, error } = await supabase
    .from("listings")
    .delete()
    .eq("resolved", false)
    .lt("date", cutoffIso)
    .select("item_id");

  if (error) {
    console.error("Failed to remove expired unresolved listings:", error);
    return 0;
  }

  return data?.length ?? 0;
}
