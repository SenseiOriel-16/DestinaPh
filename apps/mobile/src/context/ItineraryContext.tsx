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
  latitude: number | null;
  longitude: number | null;
  categoryName?: string;
  photoUrl?: string | null;
  // Optional metadata for generated results (to validate priorities).
  distanceKm?: number | null;
  ratingAverage?: number | null;
  ratingCount?: number | null;
  // Optional computed costs for generated itineraries (mainly Resorts).
  estimatedTotalPesos?: number | null;
  estimatedEntrancePesos?: number | null;
  estimatedAccommodationPesos?: number | null;
  estimatedAccommodationName?: string | null;
  estimatedAccommodationPax?: string | null;
  estimatedGroupSize?: number | null;
  estimatedPerPersonPesos?: number | null;
  // Food budget ranges (per person)
  estimatedCostMinPesos?: number | null;
  estimatedCostMaxPesos?: number | null;
};

type Ctx = {
  stops: ItineraryStop[];
  addStop: (stop: ItineraryStop) => void;
  setStops: (stops: ItineraryStop[]) => void;
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

  const setStopsList = useCallback((next: ItineraryStop[]) => {
    setStops(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
    () => ({ stops, addStop, setStops: setStopsList, removeStop, clear }),
    [stops, addStop, setStopsList, removeStop, clear],
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
