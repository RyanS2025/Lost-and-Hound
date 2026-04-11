import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_TIME_ZONE } from "../utils/timezone";

// User's manually-chosen time zone preference. Independent of campus —
// users can live in one timezone while browsing listings at a different
// campus. Persisted in AsyncStorage so it survives app restarts.

const STORAGE_KEY = "user_timezone";

interface TimezoneContextType {
  timezone: string;
  setTimezone: (tz: string) => Promise<void>;
}

const TimezoneContext = createContext<TimezoneContextType>({
  timezone: DEFAULT_TIME_ZONE,
  setTimezone: async () => {},
});

export function useTimezone() {
  return useContext(TimezoneContext);
}

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [timezone, setTimezoneState] = useState<string>(DEFAULT_TIME_ZONE);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) setTimezoneState(stored);
    });
  }, []);

  const setTimezone = useCallback(async (tz: string) => {
    setTimezoneState(tz);
    await AsyncStorage.setItem(STORAGE_KEY, tz);
  }, []);

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone }}>
      {children}
    </TimezoneContext.Provider>
  );
}
