import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../utils/supabaseClient";
import apiFetch, { clearDeviceToken, getDeviceToken } from "../utils/apiFetch";
import { registerForPushNotifications, unregisterPushToken } from "../utils/notifications";
import { ActivityIndicator, View } from "react-native";

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  default_campus: string;
  is_moderator: boolean;
  banned_until: string | null;
}

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  mfaVerified: boolean;
  setMfaVerified: (v: boolean) => void;
  updateProfile: (fields: Partial<Profile>) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  mfaVerified: false,
  setMfaVerified: () => {},
  updateProfile: () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [mfaVerified, setMfaVerified] = useState(false);

  useEffect(() => {
    // IMPORTANT: onAuthStateChange holds an internal auth lock during the callback.
    // Any Supabase call inside (directly or via apiFetch → getSession) will deadlock.
    // Do sync state updates inline, defer all async/Supabase work with setTimeout(fn, 0).
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Invalid refresh token — defer signOut to avoid re-entering the lock
      if (event === "TOKEN_REFRESHED" && !session) {
        setUser(null);
        setMfaVerified(false);
        setLoading(false);
        setTimeout(async () => {
          await clearDeviceToken();
          await supabase.auth.signOut();
        }, 0);
        return;
      }

      const nextUser = session?.user || null;
      setSessionToken(session?.access_token || null);
      setUser((prev: any) => {
        if (prev?.id === nextUser?.id) return prev;
        return nextUser;
      });

      if (!nextUser) {
        setMfaVerified(false);
        setLoading(false);
        return;
      }

      // Defer device-token check outside the lock
      setTimeout(async () => {
        try {
          const deviceToken = await getDeviceToken();
          if (deviceToken) {
            try {
              const checkData = await apiFetch("/api/auth/check-device", { method: "POST" });
              if (checkData?.trusted === true) {
                setMfaVerified(true);
              }
            } catch (err: any) {
              if (err.message?.includes("token") || err.message?.includes("401")) {
                await clearDeviceToken();
                await supabase.auth.signOut();
                setUser(null);
                setMfaVerified(false);
              }
            }
          }
        } finally {
          setLoading(false);
        }
      }, 0);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const [pushToken, setPushToken] = useState<string | null>(null);

  // Only fetch profile + register push once MFA is verified
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id || !sessionToken || !mfaVerified) {
        if (!mfaVerified) return;
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

      // Register for push notifications
      const token = await registerForPushNotifications();
      if (token) setPushToken(token);
    };
    fetchProfile();
  }, [user?.id, sessionToken, mfaVerified]);

  const logout = async () => {
    // Unregister push token before signing out
    if (pushToken) {
      await unregisterPushToken(pushToken).catch(() => {});
      setPushToken(null);
    }
    setSessionToken(null);
    setMfaVerified(false);
    setProfile(null);
    await clearDeviceToken();
    await supabase.auth.signOut();
  };

  const updateProfile = (fields: Partial<Profile>) => {
    setProfile((prev) => (prev ? { ...prev, ...fields } : null));
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#101214" }}>
        <ActivityIndicator size="large" color="#A84D48" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, mfaVerified, setMfaVerified, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
