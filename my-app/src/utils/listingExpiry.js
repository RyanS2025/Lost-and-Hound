import apiFetch from "./apiFetch";

export async function removeExpiredUnresolvedListings() {
  try {
    await apiFetch("/api/listings/cleanup", { method: "POST" });
  } catch (error) {
    console.error("Failed to remove expired unresolved listings:", error);
  }
}
