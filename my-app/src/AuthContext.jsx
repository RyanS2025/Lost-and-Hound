import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../backend/supabaseClient";
import apiFetch from "./utils/apiFetch";
import LoadingScreen from "./components/LoadingScreen";

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
  // Detect recovery token in URL synchronously to prevent flash of login page.
  // Supabase's JS client auto-detects token_hash & type in the URL and verifies
  // the token internally — we don't call verifyOtp manually to avoid a duplicate
  // call that would 403 (token already consumed by Supabase's auto-detection).
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return !!(params.get("token_hash") && params.get("type") === "recovery");
  });

  useEffect(() => {
    // onAuthStateChange fires immediately with INITIAL_SESSION.
    // Track session token changes so profile refetches after MFA verify updates JWT claims.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      }
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
      if (!user?.id || !sessionToken || isPasswordRecovery) {
        if (!isPasswordRecovery) setProfile(null);
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
  }, [user?.id, sessionToken, isPasswordRecovery]);

  // Real-time ban enforcement: subscribe to the user's own profile row so any
  // ban applied by a moderator activates immediately without a page refresh.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile-ban-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          setProfile((prev) => prev ? { ...prev, ...payload.new } : payload.new);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const logout = async () => {
    setSessionToken(null);
    await supabase.auth.signOut();
  };

  // Forgot password function
  const forgotPassword = async (email) => {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
  };

  // Allow components to update profile fields in memory (e.g. after settings save)
  const updateProfile = (fields) => {
    setProfile((prev) => ({ ...prev, ...fields }));
  };

  if (loading) return <LoadingScreen />;

  return (
    <AuthContext.Provider value={{ user, profile, sessionToken, updateProfile, logout, forgotPassword, isPasswordRecovery, setIsPasswordRecovery }}>
      {children}
    </AuthContext.Provider>
  );
}