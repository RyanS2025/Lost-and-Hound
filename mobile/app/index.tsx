import { Redirect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";

export default function Index() {
  const { user, mfaVerified } = useAuth();
  return <Redirect href={user && mfaVerified ? "/(tabs)/feed" : "/(auth)/login"} />;
}
