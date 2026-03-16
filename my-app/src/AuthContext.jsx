import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../backend/supabaseClient";
import apiFetch from "./utils/apiFetch";

const AuthContext = createContext();

// --- useAuth: Custom hook to access AuthContext ---
export function useAuth() {
  return useContext(AuthContext);
}

// --- AuthProvider: Provides authentication context to children ---
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    // onAuthStateChange fires immediately with INITIAL_SESSION so no separate
    // getSession() call is needed. We only update user state when the user ID
    // actually changes to prevent cascading profile re-fetches on token refresh.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null;
      setUser(prev => {
        if (prev?.id === nextUser?.id) return prev; // no-op if same user
        return nextUser;
      });
      setLoading(false);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Fetch profile info when user ID changes; skip if already loaded for this user
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) {
        setProfile(null);
        return;
      }
      try {
        const data = await apiFetch("/api/profile");
        setProfile(data);
      } catch (err) {
        console.error("Profile fetch error:", err);
        setProfile(null);
      }
      };

    fetchProfile();
  }, [user?.id]); // depend only on user ID, not the whole user object

  const logout = async () => {
    await supabase.auth.signOut();
  };

  // Forgot password function
  const forgotPassword = async (email) => {
    return supabase.auth.resetPasswordForEmail(email);
  };

  // Allow components to update profile fields in memory (e.g. after settings save)
  const updateProfile = (fields) => {
    setProfile((prev) => ({ ...prev, ...fields }));
  };

  if (loading) return <div>Loading...</div>;

  return (
    <AuthContext.Provider value={{ user, profile, updateProfile, logout, forgotPassword }}>
      {children}
    </AuthContext.Provider>
  );
}