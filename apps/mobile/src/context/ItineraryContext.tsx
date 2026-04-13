import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ItineraryStop = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  categoryName?: string;
  photoUrl?: string | null;
};

type Ctx = {
  stops: ItineraryStop[];
  addStop: (stop: ItineraryStop) => void;
  removeStop: (id: string) => void;
  clear: () => void;
};

const ItineraryContext = createContext<Ctx | undefined>(undefined);
const STORAGE_KEY = "destinaph_itinerary_v1";

export function ItineraryProvider({ children }: { children: ReactNode }) {
  const [stops, setStops] = useState<ItineraryStop[]>([]);

  useEffect(() => {
    void (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as ItineraryStop[];
        if (Array.isArray(parsed)) setStops(parsed);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const addStop = useCallback((stop: ItineraryStop) => {
    setStops((prev) => {
      if (prev.some((s) => s.id === stop.id)) return prev;
      const next = [...prev, stop];
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeStop = useCallback((id: string) => {
    setStops((prev) => {
      const next = prev.filter((s) => s.id !== id);
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setStops([]);
    void AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ stops, addStop, removeStop, clear }),
    [stops, addStop, removeStop, clear],
  );

  return (
    <ItineraryContext.Provider value={value}>{children}</ItineraryContext.Provider>
  );
}

export function useItinerary() {
  const ctx = useContext(ItineraryContext);
  if (!ctx) {
    throw new Error("useItinerary must be used within ItineraryProvider");
  }
  return ctx;
}
