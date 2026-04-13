import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import { ItemsProvider } from "../contexts/ItemsContext";
import { TimezoneProvider } from "../contexts/TimezoneContext";
import { ConversationsProvider } from "../contexts/ConversationsContext";
import { StatusBar } from "expo-status-bar";
import OfflineBanner from "../components/OfflineBanner";

function AuthGate() {
  const { user, mfaVerified } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === "(auth)";

    if ((!user || !mfaVerified) && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && mfaVerified && inAuthGroup) {
      router.replace("/(tabs)/feed");
    }
  }, [user, mfaVerified, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TimezoneProvider>
          <ItemsProvider>
            <ConversationsProvider>
              <StatusBar style="auto" />
              <OfflineBanner />
              <AuthGate />
            </ConversationsProvider>
          </ItemsProvider>
        </TimezoneProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
