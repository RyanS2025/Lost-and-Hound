import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../backend/supabaseClient";
import apiFetch, { clearDeviceToken } from "./utils/apiFetch";

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
  const [sessionToken, setSessionToken] = useState(null);

  useEffect(() => {
    // onAuthStateChange fires immediately with INITIAL_SESSION.
    // Track session token changes so profile refetches after MFA verify updates JWT claims.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null;
      setSessionToken(session?.access_token || null);
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

  // Fetch profile when user ID changes or when auth token changes (e.g. after MFA verify).
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id || !sessionToken) {
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
  }, [user?.id, sessionToken]);

  const logout = async () => {
    clearDeviceToken();
    setSessionToken(null);
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