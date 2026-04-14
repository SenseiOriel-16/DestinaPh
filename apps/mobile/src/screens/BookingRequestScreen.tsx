import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  type ImageSourcePropType,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { BookingsStackParamList, ExploreStackParamList, HomeStackParamList } from "../navigation/tabTypes";
import { type AccommodationItem, normalizeAccommodations } from "../lib/accommodations";
import { type LocalImage, uploadBookingPaymentProof } from "../lib/uploadBookingProof";
import { supabase } from "../lib/supabase";
import { colors } from "../theme/colors";
import { GlassPanel } from "../ui/GlassPanel";

type AnyBookingRequestProps =
  | NativeStackScreenProps<HomeStackParamList, "BookingRequest">
  | NativeStackScreenProps<ExploreStackParamList, "BookingRequest">
  | NativeStackScreenProps<BookingsStackParamList, "BookingRequest">;

type PayMethod = "gcash" | "maya" | "paypal";
type TripPeriod = "day" | "night";

const FOOD_SLUG = "food-dining";

const PAY_METHOD_ASSETS: Record<PayMethod, { name: string; logo: ImageSourcePropType }> = {
  gcash: { name: "GCash", logo: require("../../assets/gcashlogo.png") },
  maya: { name: "Maya", logo: require("../../assets/mayalogo.png") },
  paypal: { name: "PayPal", logo: require("../../assets/paypallogo.jpg") },
};

function randomBookingId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const d0 = new Date(`${checkIn}T12:00:00`);
  const d1 = new Date(`${checkOut}T12:00:00`);
  if (Number.isNaN(d0.getTime()) || Number.isNaN(d1.getTime())) return 0;
  const ms = d1.getTime() - d0.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_24H_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
type StayDetailPicker = "hour" | "meridiem";

function WebDateInput({
  value,
  onChange,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  "aria-label": string;
}) {
  // NOTE: React Native Web `TextInput` doesn't reliably support `type="date"`.
  // Render a real HTML input on web to guarantee calendar picker.
  const inputRef = useRef<HTMLInputElement | null>(null);
  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    // Chromium supports showPicker(); fallback to focus+click.
    const anyEl = el as any;
    if (typeof anyEl.showPicker === "function") anyEl.showPicker();
    else {
      el.focus();
      el.click();
    }
  };

  return (
    <div style={{ width: "100%", marginTop: 6 }}>
      {/* Hide native calendar affordance where possible (Chrome/Safari). */}
      <style>{`
        input[data-dph-date="1"]::-webkit-calendar-picker-indicator { opacity: 0; display: none; }
        input[data-dph-date="1"]::-webkit-inner-spin-button { display: none; }
      `}</style>
      <div
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "rgba(255,255,255,0.64)",
          backgroundColor: "rgba(255,255,255,0.22)",
          padding: 12,
          boxSizing: "border-box",
          cursor: "pointer",
        }}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.muted2} />
        <input
          ref={inputRef}
          aria-label={ariaLabel}
          data-dph-date="1"
          type="date"
          value={DATE_RE.test(value.trim()) ? value.trim() : ""}
          onChange={(e) => onChange((e.target as HTMLInputElement).value)}
          onClick={(e) => {
            // Prevent wrapper click from firing twice.
            e.stopPropagation();
          }}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            background: "transparent",
            color: colors.text,
            fontSize: 15,
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}

function parseLocalDateFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function formatYmdFromDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function normalizeArrivalTime(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  // Accept strict 24h first: HH:MM
  if (TIME_24H_RE.test(raw)) return raw;

  // Accept "12am" / "12pm" / "5pm" / "5 pm" (assume :00)
  const shortAmpm = /^(\d{1,2})\s*(am|pm)$/.exec(raw);
  if (shortAmpm) {
    let h = Number(shortAmpm[1]);
    const ap = shortAmpm[2];
    if (!Number.isFinite(h) || h < 1 || h > 12) return null;
    if (ap === "am") h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
    return `${String(h).padStart(2, "0")}:00`;
  }

  // Accept H:MM (pad hour)
  const hm = /^(\d{1,2}):([0-5]\d)$/.exec(raw);
  if (hm) {
    const h = Number(hm[1]);
    const m = hm[2];
    if (!Number.isFinite(h) || h < 0 || h > 23) return null;
    return `${String(h).padStart(2, "0")}:${m}`;
  }

  // Accept H:MM am/pm or HH:MM am/pm
  const ampm = /^(\d{1,2}):([0-5]\d)\s*(am|pm)$/.exec(raw);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = ampm[2];
    const ap = ampm[3];
    if (!Number.isFinite(h) || h < 1 || h > 12) return null;
    if (ap === "am") h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
    return `${String(h).padStart(2, "0")}:${m}`;
  }

  return null;
}

export function BookingRequestScreen({ route, navigation }: AnyBookingRequestProps) {
  const { businessId } = route.params;
  const [placeName, setPlaceName] = useState("");
  const [categorySlug, setCategorySlug] = useState<string>("");
  const [accommodations, setAccommodations] = useState<AccommodationItem[]>([]);
  const [operatingDay, setOperatingDay] = useState(false);
  const [operatingNight, setOperatingNight] = useState(false);
  const [entranceFeeDay, setEntranceFeeDay] = useState<number | null>(null);
  const [entranceFeeNight, setEntranceFeeNight] = useState<number | null>(null);
  const [entranceFeeDefault, setEntranceFeeDefault] = useState<number | null>(null);
  const [payGcash, setPayGcash] = useState(false);
  const [payMaya, setPayMaya] = useState(false);
  const [payPaypal, setPayPaypal] = useState(false);
  const [gcashPath, setGcashPath] = useState<string | null>(null);
  const [mayaPath, setMayaPath] = useState<string | null>(null);
  const [gcashAccountName, setGcashAccountName] = useState("");
  const [gcashAccountNumber, setGcashAccountNumber] = useState("");
  const [mayaAccountName, setMayaAccountName] = useState("");
  const [mayaAccountNumber, setMayaAccountNumber] = useState("");
  const [gcashLabel, setGcashLabel] = useState("");
  const [mayaLabel, setMayaLabel] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [paypalAccountName, setPaypalAccountName] = useState("");
  const [selectedAccIndex, setSelectedAccIndex] = useState<number | null>(null);
  const [accPickerOpen, setAccPickerOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [arrivalHour12, setArrivalHour12] = useState<number>(1);
  const [arrivalMeridiem, setArrivalMeridiem] = useState<"AM" | "PM">("AM");
  const [androidDateJob, setAndroidDateJob] = useState<null | { which: "checkin" | "checkout"; value: Date }>(null);
  const [iosDateModal, setIosDateModal] = useState<null | "checkin" | "checkout">(null);
  const [iosPickDate, setIosPickDate] = useState(new Date());
  const [stayDetailPicker, setStayDetailPicker] = useState<null | StayDetailPicker>(null);
  const [tripPeriod, setTripPeriod] = useState<TripPeriod | null>(null);
  const [guestCount, setGuestCount] = useState("2");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PayMethod | null>(null);
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<LocalImage | null>(null);
  const [loadingBiz, setLoadingBiz] = useState(true);
  const [sending, setSending] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [doneModalOpen, setDoneModalOpen] = useState(false);
  const [doneBookingId, setDoneBookingId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoadingBiz(true);
      const { data, error } = await supabase
        .from("businesses")
        .select(
          "name,allow_reservations,accommodations,entrance_fee_pesos,entrance_fee_day_pesos,entrance_fee_night_pesos,operating_day,operating_night,categories(slug),pay_gcash_enabled,pay_maya_enabled,pay_paypal_enabled,pay_gcash_qr_path,pay_maya_qr_path,pay_gcash_account_label,pay_maya_account_label,pay_paypal_email,pay_paypal_account_name,pay_gcash_account_name,pay_gcash_account_number,pay_maya_account_name,pay_maya_account_number",
        )
        .eq("id", businessId)
        .maybeSingle();
      if (error || !data) {
        Alert.alert("Error", error?.message ?? "Could not load listing.");
        setLoadingBiz(false);
        return;
      }
      const row = data as Record<string, unknown>;
      if ((row as any).allow_reservations === false) {
        Alert.alert("Reservations disabled", "This destination is not accepting reservations right now.");
        navigation.goBack();
        return;
      }
      setPlaceName(String(row.name ?? ""));
      setCategorySlug(String((row as any).categories?.slug ?? "").trim());
      setAccommodations(normalizeAccommodations(row.accommodations));
      const opDay = Boolean((row as any).operating_day);
      const opNight = Boolean((row as any).operating_night);
      setOperatingDay(opDay);
      setOperatingNight(opNight);
      const ef = (row as any).entrance_fee_pesos;
      const efd = (row as any).entrance_fee_day_pesos;
      const efn = (row as any).entrance_fee_night_pesos;
      setEntranceFeeDefault(typeof ef === "number" && Number.isFinite(ef) ? ef : null);
      setEntranceFeeDay(typeof efd === "number" && Number.isFinite(efd) ? efd : null);
      setEntranceFeeNight(typeof efn === "number" && Number.isFinite(efn) ? efn : null);
      // Default period selection when only one is available.
      if (opDay && !opNight) setTripPeriod("day");
      else if (opNight && !opDay) setTripPeriod("night");
      else if (!opDay && !opNight) setTripPeriod("day"); // fallback
      setPayGcash(Boolean(row.pay_gcash_enabled));
      setPayMaya(Boolean(row.pay_maya_enabled));
      setPayPaypal(Boolean(row.pay_paypal_enabled));
      setGcashPath((row.pay_gcash_qr_path as string) || null);
      setMayaPath((row.pay_maya_qr_path as string) || null);
      const gcName = String((row as any).pay_gcash_account_name ?? "").trim();
      const gcNo = String((row as any).pay_gcash_account_number ?? "").trim();
      const myName = String((row as any).pay_maya_account_name ?? "").trim();
      const myNo = String((row as any).pay_maya_account_number ?? "").trim();
      setGcashAccountName(gcName);
      setGcashAccountNumber(gcNo);
      setMayaAccountName(myName);
      setMayaAccountNumber(myNo);
      setGcashLabel(gcName || gcNo ? `${gcName}${gcName && gcNo ? " · " : ""}${gcNo}` : String(row.pay_gcash_account_label ?? ""));
      setMayaLabel(myName || myNo ? `${myName}${myName && myNo ? " · " : ""}${myNo}` : String(row.pay_maya_account_label ?? ""));
      setPaypalEmail(String(row.pay_paypal_email ?? ""));
      setPaypalAccountName(String((row as any).pay_paypal_account_name ?? "").trim());
      setLoadingBiz(false);
    })();
  }, [businessId]);

  const isFood = categorySlug === FOOD_SLUG;

  // Food listings should use a single visit date. Keep checkout synced for DB compatibility.
  useEffect(() => {
    if (!isFood) return;
    const d = checkIn.trim();
    if (DATE_RE.test(d) && checkOut.trim() !== d) setCheckOut(d);
    if (!DATE_RE.test(d) && checkOut.trim()) setCheckOut("");
  }, [isFood, checkIn, checkOut]);

  const availableAccs = useMemo(
    () => accommodations.map((a, i) => ({ a, i })).filter(({ a }) => a.available !== false && a.name.trim()),
    [accommodations],
  );
  const selectedAccName = useMemo(() => {
    if (selectedAccIndex == null) return "";
    const a = accommodations[selectedAccIndex];
    return a?.name?.trim?.() ? a.name.trim() : "";
  }, [selectedAccIndex, accommodations]);

  const nights = useMemo(
    () => (isFood ? 0 : nightsBetween(checkIn.trim(), checkOut.trim())),
    [checkIn, checkOut, isFood],
  );

  const arrivalTimeStr = useMemo(
    () => `${arrivalHour12}${arrivalMeridiem === "AM" ? "am" : "pm"}`,
    [arrivalHour12, arrivalMeridiem],
  );

  const openDatePicker = useCallback((which: "checkin" | "checkout") => {
    const raw = which === "checkin" ? checkIn : checkOut;
    const base = DATE_RE.test(raw.trim()) ? parseLocalDateFromYmd(raw.trim()) : new Date();
    if (Platform.OS === "android") {
      setAndroidDateJob({ which, value: base });
      return;
    }
    if (Platform.OS === "web") {
      return;
    }
    setIosPickDate(base);
    setIosDateModal(which);
  }, [checkIn, checkOut]);
  const pricePerNight =
    selectedAccIndex != null &&
    accommodations[selectedAccIndex]?.price_pesos &&
    accommodations[selectedAccIndex].price_pesos > 0
      ? accommodations[selectedAccIndex].price_pesos
      : 0;
  const accommodationCost = pricePerNight > 0 && nights > 0 ? pricePerNight * nights : 0;
  const guests = Math.max(1, parseInt(guestCount, 10) || 1);
  const entranceFeeEachRaw =
    tripPeriod === "night"
      ? entranceFeeNight ?? entranceFeeDefault
      : entranceFeeDay ?? entranceFeeDefault;
  const entranceFeeEach = entranceFeeEachRaw != null && entranceFeeEachRaw > 0 ? entranceFeeEachRaw : 0;
  const entranceCost = entranceFeeEach > 0 ? entranceFeeEach * guests : 0;
  const totalAmount = accommodationCost + entranceCost;
  const downpaymentPesos = totalAmount > 0 ? Math.ceil(totalAmount * 0.5) : 0;

  const gcashQrUrl = gcashPath
    ? supabase.storage.from("booking-qrcodes").getPublicUrl(gcashPath).data.publicUrl
    : null;
  const mayaQrUrl = mayaPath
    ? supabase.storage.from("booking-qrcodes").getPublicUrl(mayaPath).data.publicUrl
    : null;

  const enabledMethods = useMemo(() => {
    const m: PayMethod[] = [];
    const gcashReady =
      payGcash &&
      (Boolean(gcashPath) || (Boolean(gcashAccountName.trim()) && Boolean(gcashAccountNumber.trim())));
    const mayaReady =
      payMaya && (Boolean(mayaPath) || (Boolean(mayaAccountName.trim()) && Boolean(mayaAccountNumber.trim())));
    if (gcashReady) m.push("gcash");
    if (mayaReady) m.push("maya");
    if (payPaypal && paypalEmail.trim()) m.push("paypal");
    return m;
  }, [
    payGcash,
    payMaya,
    payPaypal,
    gcashPath,
    mayaPath,
    paypalEmail,
    gcashAccountName,
    gcashAccountNumber,
    mayaAccountName,
    mayaAccountNumber,
  ]);

  const paymentOptional = enabledMethods.length === 0;

  const pickProof = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos", "Allow photo access to attach payment proof.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      const a = res.assets[0];
      setProof({ uri: a.uri, base64: a.base64 ?? null, mimeType: (a as any).mimeType ?? null });
    }
  };

  const submit = async () => {
    setSubmitMsg(null);
    if (!fullName.trim()) {
      setSubmitMsg("Please enter your full name.");
      return;
    }
    if (!contactNumber.trim()) {
      setSubmitMsg("Please enter your contact number.");
      return;
    }
    if (!DATE_RE.test(checkIn.trim()) || (!isFood && !DATE_RE.test(checkOut.trim()))) {
      setSubmitMsg(isFood ? "Enter visit date as YYYY-MM-DD (e.g. 2026-05-01)." : "Enter check-in and check-out as YYYY-MM-DD (e.g. 2026-05-01).");
      return;
    }
    if (!isFood && nights < 1) {
      setSubmitMsg("Check-out must be after check-in.");
      return;
    }
    const normalizedArrival = normalizeArrivalTime(arrivalTimeStr);
    if (!normalizedArrival) {
      setSubmitMsg("Choose arrival time: hour (1–12) and AM or PM.");
      return;
    }
    if (operatingDay && operatingNight && !tripPeriod) {
      setSubmitMsg("Please select Day trip or Night trip.");
      return;
    }
    if (availableAccs.length > 0 && selectedAccIndex == null) {
      setSubmitMsg("Please select an accommodation type.");
      return;
    }
    if (!paymentOptional) {
      if (!paymentMethod || !enabledMethods.includes(paymentMethod)) {
        setSubmitMsg("Choose a payment method the property accepts.");
        return;
      }
      if (!reference.trim()) {
        setSubmitMsg("Enter your payment reference / transaction ID.");
        return;
      }
      if (!proof) {
        setSubmitMsg("Attach a screenshot of your payment.");
        return;
      }
    }

    setSending(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) {
        setSubmitMsg("Please sign in as a traveler to reserve.");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
      if (profile?.role !== "consumer") {
        setSubmitMsg("Reservations are for traveler (consumer) accounts.");
        return;
      }
      const bookingId = randomBookingId();
      let proofStoragePath: string | null = null;
      if (!paymentOptional) {
        const up = await uploadBookingPaymentProof(supabase, uid, bookingId, proof!);
        if ("error" in up) {
          setSubmitMsg(up.error);
          return;
        }
        proofStoragePath = up.storagePath;
      }

      const accName =
        selectedAccIndex != null && accommodations[selectedAccIndex]?.name?.trim()
          ? accommodations[selectedAccIndex].name.trim()
          : "General";

      const { error } = await supabase.from("bookings").insert({
        id: bookingId,
        business_id: businessId,
        user_id: uid,
        status: "pending_review",
        notes: notes.trim() || null,
        traveler_full_name: fullName.trim(),
        traveler_contact_number: contactNumber.trim(),
        arrival_time: normalizedArrival,
        trip_period: tripPeriod ?? "day",
        entrance_fee_each_pesos: entranceFeeEach > 0 ? entranceFeeEach : null,
        entrance_fee_total_pesos: entranceCost > 0 ? entranceCost : null,
        accommodation_cost_pesos: accommodationCost > 0 ? accommodationCost : null,
        accommodation_name: accName,
        check_in: checkIn.trim(),
        check_out: isFood ? checkIn.trim() : checkOut.trim(),
        guest_count: guests,
        estimated_total_pesos: totalAmount > 0 ? totalAmount : null,
        downpayment_percent: 50,
        downpayment_pesos: downpaymentPesos > 0 ? downpaymentPesos : null,
        payment_method: paymentOptional ? null : paymentMethod,
        payment_reference: paymentOptional ? null : reference.trim(),
        payment_proof_storage_path: proofStoragePath,
      });

      if (error) {
        const anyErr = error as any;
        const msgParts = [
          anyErr?.message,
          anyErr?.details ? `Details: ${anyErr.details}` : null,
          anyErr?.hint ? `Hint: ${anyErr.hint}` : null,
        ].filter(Boolean);
        setSubmitMsg(msgParts.length ? msgParts.join("\n") : "Booking failed. Please try again.");
        return;
      }

      setDoneBookingId(bookingId);
      setDoneModalOpen(true);
    } finally {
      setSending(false);
    }
  };

  const goToBookings = () => {
    // Try to navigate to the parent tab route first (works when this screen is inside Home/Explore stacks).
    const parent: any = (navigation as any).getParent?.();
    try {
      if (parent?.navigate) {
        parent.navigate("Bookings", { screen: "BookingsMain" });
        return;
      }
    } catch {
      // ignore
    }
    // Fallback: if we're already inside the Bookings stack.
    try {
      (navigation as any).navigate("BookingsMain");
    } catch {
      navigation.goBack();
    }
  };

  if (loadingBiz) {
    return (
      <View style={[styles.page, styles.center]}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <Modal visible={doneModalOpen} transparent animationType="fade" onRequestClose={() => setDoneModalOpen(false)}>
        <Pressable style={styles.doneModalOverlay} onPress={() => setDoneModalOpen(false)} />
        <View style={styles.doneWrap} pointerEvents="box-none">
          <View style={styles.doneCardSolid}>
            <View style={styles.doneIconSolid}>
              <Ionicons name="checkmark" size={34} color="#fff" />
            </View>
            <Text style={styles.doneTitle}>Reservation submitted</Text>
            <Text style={styles.doneText}>
              Done na ang reservation mo. Mag-antay lang ng confirmation ng owner.
            </Text>
            <View style={styles.doneBtns}>
              <Pressable
                style={({ pressed }) => [styles.doneBtnPrimary, pressed && styles.doneBtnPressed]}
                onPress={() => {
                  setDoneModalOpen(false);
                  goToBookings();
                }}
              >
                <Text style={styles.doneBtnPrimaryTxt}>View status</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.doneBtnGhost, pressed && styles.doneBtnPressed]}
                onPress={() => {
                  setDoneModalOpen(false);
                  if (doneBookingId) navigation.goBack();
                }}
              >
                <Text style={styles.doneBtnGhostTxt}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <GlassPanel style={styles.headerCard} contentStyle={styles.headerCardInner} borderRadius={24} intensity={62}>
          <Text style={styles.title}>Reserve your stay</Text>
          <Text style={styles.sub}>{placeName || "Destination"}</Text>
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={18} color={colors.primaryTeal} />
            <Text style={styles.infoText}>
              {paymentOptional
                ? "Submit your stay details. The owner will confirm directly — no in-app payment is set up for this listing."
                : "You only need to pay 50% to reserve your booking when this property accepts online payment."}
            </Text>
          </View>
        </GlassPanel>

        <GlassPanel style={styles.card} contentStyle={styles.cardInner}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="person-circle-outline" size={20} color={colors.navy} />
            <Text style={styles.sectionTitle}>Guest details</Text>
          </View>

          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.inputSm}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your full name (e.g. Juan dela Cruz)"
            placeholderTextColor={colors.muted2}
          />

          <Text style={[styles.label, styles.mtSm]}>Contact number</Text>
          <TextInput
            style={styles.inputSm}
            value={contactNumber}
            onChangeText={setContactNumber}
            placeholder="Mobile number (e.g. 09xx xxx xxxx)"
            placeholderTextColor={colors.muted2}
            keyboardType="phone-pad"
          />
        </GlassPanel>

      {availableAccs.length > 0 ? (
        <GlassPanel style={styles.card} contentStyle={styles.cardInner}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="bed-outline" size={20} color={colors.navy} />
            <Text style={styles.sectionTitle}>Accommodation</Text>
          </View>
          <Text style={styles.label}>Select accommodation</Text>
          <Pressable
            style={({ pressed }) => [styles.dropdownBtn, pressed && { opacity: 0.95 }]}
            onPress={() => setAccPickerOpen(true)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.dropdownValue} numberOfLines={1}>
                {selectedAccIndex != null && selectedAccName ? selectedAccName : "Tap to choose"}
              </Text>
              {selectedAccIndex != null && accommodations[selectedAccIndex]?.price_pesos ? (
                <Text style={styles.dropdownHint} numberOfLines={1}>
                  {`\u20B1${Number(accommodations[selectedAccIndex].price_pesos).toLocaleString("en-PH")}/night`}
                </Text>
              ) : (
                <Text style={styles.dropdownHint} numberOfLines={1}>
                  Choose from available rooms
                </Text>
              )}
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.navy} />
          </Pressable>

          <Modal
            visible={accPickerOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setAccPickerOpen(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setAccPickerOpen(false)} />
            <View style={styles.modalSheetWrap} pointerEvents="box-none">
              <GlassPanel style={styles.modalSheet} contentStyle={styles.modalSheetInner} borderRadius={22} intensity={66}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Choose accommodation</Text>
                  <Pressable style={styles.modalClose} onPress={() => setAccPickerOpen(false)}>
                    <Ionicons name="close" size={22} color={colors.navy} />
                  </Pressable>
                </View>
                <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                  {availableAccs.map(({ a, i }) => (
                    <Pressable
                      key={`${a.name}-${i}`}
                      style={[styles.choice, selectedAccIndex === i && styles.choiceOn]}
                      onPress={() => {
                        setSelectedAccIndex(i);
                        setAccPickerOpen(false);
                      }}
                    >
                      <View style={styles.choiceRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.choiceTitle}>{a.name}</Text>
                          <Text style={styles.choiceMeta}>
                            {a.pax ? `${a.pax} · ` : ""}
                            {a.price_pesos > 0
                              ? `\u20B1${a.price_pesos.toLocaleString("en-PH")}/night`
                              : "Price on request"}
                          </Text>
                        </View>
                        <Ionicons
                          name={selectedAccIndex === i ? "checkmark-circle" : "ellipse-outline"}
                          size={22}
                          color={selectedAccIndex === i ? colors.primaryTeal : colors.muted2}
                        />
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </GlassPanel>
            </View>
          </Modal>
        </GlassPanel>
      ) : (
        <Text style={styles.warn}>No accommodation types listed — select dates and guests only.</Text>
      )}

      <GlassPanel style={styles.card} contentStyle={styles.cardInner}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="calendar-outline" size={20} color={colors.navy} />
          <Text style={styles.sectionTitle}>Dates & time</Text>
        </View>

        <View style={styles.grid2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{isFood ? "Visit date" : "Check-in"}</Text>
            {Platform.OS === "web" ? (
              <WebDateInput
                value={checkIn}
                onChange={setCheckIn}
                aria-label={isFood ? "Choose visit date" : "Choose check-in date"}
              />
            ) : (
              <Pressable
                style={styles.dateFieldBtn}
                onPress={() => openDatePicker("checkin")}
                accessibilityRole="button"
                accessibilityLabel={isFood ? "Choose visit date" : "Choose check-in date"}
              >
                <Text style={[styles.dropdownValue, !checkIn.trim() && styles.dateFieldPlaceholder]}>
                  {DATE_RE.test(checkIn.trim()) ? checkIn.trim() : "Select date"}
                </Text>
                <Ionicons name="calendar-outline" size={20} color={colors.muted2} />
              </Pressable>
            )}
          </View>
          {!isFood ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Check-out</Text>
              {Platform.OS === "web" ? (
                <WebDateInput value={checkOut} onChange={setCheckOut} aria-label="Choose check-out date" />
              ) : (
                <Pressable
                  style={styles.dateFieldBtn}
                  onPress={() => openDatePicker("checkout")}
                  accessibilityRole="button"
                  accessibilityLabel="Choose check-out date"
                >
                  <Text style={[styles.dropdownValue, !checkOut.trim() && styles.dateFieldPlaceholder]}>
                    {DATE_RE.test(checkOut.trim()) ? checkOut.trim() : "Select date"}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={colors.muted2} />
                </Pressable>
              )}
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
        </View>

        <View style={styles.grid2}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, styles.mtSm]}>Guests</Text>
            <View style={[styles.dropdownBtn, styles.dropdownBtnCompact, styles.guestInputWrap]}>
              <TextInput
                value={guestCount}
                onChangeText={(t) => setGuestCount(t.replace(/[^\d]/g, "").slice(0, 2))}
                placeholder="e.g. 2"
                placeholderTextColor={colors.muted2}
                keyboardType="number-pad"
                inputMode="numeric"
                style={styles.guestInput}
                accessibilityLabel="Number of guests"
              />
              <Text style={styles.guestSuffix}>{guests === 1 ? "guest" : "guests"}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, styles.mtSm]}>Arrival time</Text>
            <View style={styles.arrivalWrap} accessibilityLabel="Arrival time">
              <View style={styles.arrivalCombo}>
                <Pressable
                  style={({ pressed }) => [styles.arrivalComboHour, pressed && styles.arrivalComboPressed]}
                  onPress={() => setStayDetailPicker("hour")}
                  accessibilityRole="button"
                  accessibilityLabel="Arrival hour, tap to change"
                >
                  <Text style={styles.arrivalComboText}>{arrivalHour12}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.arrivalComboMeridiem, pressed && styles.arrivalComboPressed]}
                  onPress={() => setStayDetailPicker("meridiem")}
                  accessibilityRole="button"
                  accessibilityLabel="AM or PM, tap to change"
                >
                  <Text style={styles.arrivalComboText}>{arrivalMeridiem}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        <Modal
          visible={stayDetailPicker !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setStayDetailPicker(null)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setStayDetailPicker(null)} />
          <View style={styles.modalSheetWrap} pointerEvents="box-none">
            <GlassPanel style={styles.modalSheet} contentStyle={styles.modalSheetInner} borderRadius={22} intensity={66}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {stayDetailPicker === "hour"
                      ? "Arrival hour"
                      : stayDetailPicker === "meridiem"
                        ? "AM or PM"
                        : ""}
                </Text>
                <Pressable style={styles.modalClose} onPress={() => setStayDetailPicker(null)} accessibilityLabel="Close">
                  <Ionicons name="close" size={22} color={colors.navy} />
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {stayDetailPicker === "hour"
                  ? HOURS_12.map((h) => {
                      const on = arrivalHour12 === h;
                      return (
                        <Pressable
                          key={h}
                          style={[styles.choice, on && styles.choiceOn]}
                          onPress={() => {
                            setArrivalHour12(h);
                            setStayDetailPicker(null);
                          }}
                        >
                          <View style={styles.choiceRow}>
                            <Text style={styles.choiceTitle}>{h}</Text>
                            <Ionicons
                              name={on ? "checkmark-circle" : "ellipse-outline"}
                              size={22}
                              color={on ? colors.primaryTeal : colors.muted2}
                            />
                          </View>
                        </Pressable>
                      );
                    })
                  : null}
                {stayDetailPicker === "meridiem"
                  ? (["AM", "PM"] as const).map((ap) => {
                      const on = arrivalMeridiem === ap;
                      return (
                        <Pressable
                          key={ap}
                          style={[styles.choice, on && styles.choiceOn]}
                          onPress={() => {
                            setArrivalMeridiem(ap);
                            setStayDetailPicker(null);
                          }}
                        >
                          <View style={styles.choiceRow}>
                            <Text style={styles.choiceTitle}>{ap}</Text>
                            <Ionicons
                              name={on ? "checkmark-circle" : "ellipse-outline"}
                              size={22}
                              color={on ? colors.primaryTeal : colors.muted2}
                            />
                          </View>
                        </Pressable>
                      );
                    })
                  : null}
              </ScrollView>
            </GlassPanel>
          </View>
        </Modal>

      {operatingDay || operatingNight ? (
        <View style={styles.tripBlock}>
          <Text style={[styles.label, styles.mtSm]}>Trip period</Text>
          <View style={styles.tripRow}>
            {operatingDay ? (
              <Pressable
                style={[styles.tripBtn, tripPeriod === "day" && styles.tripBtnOn]}
                onPress={() => setTripPeriod("day")}
              >
                <Ionicons
                  name={tripPeriod === "day" ? "sunny" : "sunny-outline"}
                  size={18}
                  color={tripPeriod === "day" ? "#fff" : colors.navy}
                />
                <Text style={[styles.tripTxt, tripPeriod === "day" && styles.tripTxtOn]}>Day trip</Text>
              </Pressable>
            ) : null}
            {operatingNight ? (
              <Pressable
                style={[styles.tripBtn, tripPeriod === "night" && styles.tripBtnOn]}
                onPress={() => setTripPeriod("night")}
              >
                <Ionicons
                  name={tripPeriod === "night" ? "moon" : "moon-outline"}
                  size={18}
                  color={tripPeriod === "night" ? "#fff" : colors.navy}
                />
                <Text style={[styles.tripTxt, tripPeriod === "night" && styles.tripTxtOn]}>Night trip</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.mutedSmall}>
            Entrance fee depends on your trip period. {entranceFeeEach > 0 ? `Current entrance fee: ₱${entranceFeeEach.toLocaleString("en-PH")} / person` : ""}
          </Text>
        </View>
      ) : null}
      </GlassPanel>

      {totalAmount > 0 ? (
        <GlassPanel style={styles.card} contentStyle={styles.cardInner}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="wallet-outline" size={20} color={colors.navy} />
            <Text style={styles.sectionTitle}>Payment summary</Text>
          </View>
          {!isFood ? (
            <Text style={styles.summaryLine}>
              {`Accommodation: ${nights} night${nights === 1 ? "" : "s"} × \u20B1${pricePerNight.toLocaleString("en-PH")} = \u20B1${accommodationCost.toLocaleString("en-PH")}`}
            </Text>
          ) : null}
          <Text style={styles.summaryLine}>
            {entranceFeeEach > 0 ? `Entrance fee: \u20B1${entranceFeeEach.toLocaleString("en-PH")} × ${guests} = \u20B1${entranceCost.toLocaleString("en-PH")}` : "Entrance fee: —"}
          </Text>
          <View style={styles.totalRow}>
            <Text style={styles.summaryTotalLbl}>Total</Text>
            <Text style={styles.summaryTotal}>{`\u20B1${totalAmount.toLocaleString("en-PH")}`}</Text>
          </View>
          <View style={styles.downpayBox}>
            <Text style={styles.downpayK}>✅ Pay 50% downpayment</Text>
            <Text style={styles.downpayV}>{`\u20B1${downpaymentPesos.toLocaleString("en-PH")}`}</Text>
          </View>
        </GlassPanel>
      ) : (
        <Text style={styles.mutedSmall}>
          {isFood
            ? "Select a visit date to see the estimated down payment."
            : "Set valid dates and an accommodation with a nightly rate to see the estimated down payment."}
        </Text>
      )}

      <GlassPanel style={styles.card} contentStyle={styles.cardInner}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.navy} />
          <Text style={styles.sectionTitle}>Notes</Text>
        </View>
        <Text style={styles.label}>Notes for the property</Text>
        <TextInput
          style={styles.inputLg}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Special requests, arrival time…"
          placeholderTextColor={colors.muted2}
        />
      </GlassPanel>

      <GlassPanel style={styles.card} contentStyle={styles.cardInner}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="card-outline" size={20} color={colors.navy} />
          <Text style={styles.sectionTitle}>Payment</Text>
        </View>
        {paymentOptional ? (
          <Text style={styles.mutedSmall}>
            This listing has no GCash, Maya, or PayPal details on file. You can still send your reservation — coordinate
            payment directly with the owner if needed.
          </Text>
        ) : (
          <>
            <Text style={styles.label}>Pay with</Text>
            <View style={styles.payCardsRow} accessibilityRole="radiogroup" accessibilityLabel="Payment method">
              {enabledMethods.map((m) => {
                const meta = PAY_METHOD_ASSETS[m];
                const on = paymentMethod === m;
                return (
                  <Pressable
                    key={m}
                    style={[styles.payCard, on && styles.payCardOn]}
                    onPress={() => setPaymentMethod(m)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={meta.name}
                  >
                    <View style={styles.payCardLogo}>
                      <Image source={meta.logo} style={styles.payCardLogoImg} resizeMode="contain" />
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {paymentMethod === "gcash" ? (
              <View style={styles.qrBlock} pointerEvents="box-none">
                <Text style={styles.mutedSmall}>Send payment to</Text>
                {gcashAccountName ? <Text style={styles.qrHint}>{gcashAccountName}</Text> : null}
                {gcashAccountNumber ? <Text style={styles.qrHint}>{gcashAccountNumber}</Text> : gcashLabel ? <Text style={styles.qrHint}>{gcashLabel}</Text> : null}
                {gcashQrUrl ? (
                  <Image source={{ uri: gcashQrUrl }} style={styles.qrImg} resizeMode="contain" />
                ) : (
                  <Text style={[styles.mutedSmall, { marginTop: 8 }]}>
                    No QR image on file — pay in the GCash app using the account number above.
                  </Text>
                )}
              </View>
            ) : null}
            {paymentMethod === "maya" ? (
              <View style={styles.qrBlock} pointerEvents="box-none">
                <Text style={styles.mutedSmall}>Send payment to</Text>
                {mayaAccountName ? <Text style={styles.qrHint}>{mayaAccountName}</Text> : null}
                {mayaAccountNumber ? <Text style={styles.qrHint}>{mayaAccountNumber}</Text> : mayaLabel ? <Text style={styles.qrHint}>{mayaLabel}</Text> : null}
                {mayaQrUrl ? (
                  <Image source={{ uri: mayaQrUrl }} style={styles.qrImg} resizeMode="contain" />
                ) : (
                  <Text style={[styles.mutedSmall, { marginTop: 8 }]}>
                    No QR image on file — pay in the Maya app using the account number above.
                  </Text>
                )}
              </View>
            ) : null}
            {paymentMethod === "paypal" ? (
              <View style={styles.qrBlock}>
                <Text style={styles.mutedSmall}>Send payment to</Text>
                {paypalAccountName ? <Text style={styles.qrHint}>{paypalAccountName}</Text> : null}
                <Text style={styles.qrHint}>{paypalEmail}</Text>
              </View>
            ) : null}

            <Text style={[styles.label, styles.mt]}>Payment reference / transaction ID</Text>
            <TextInput
              style={styles.inputSm}
              value={reference}
              onChangeText={setReference}
              placeholder="Ref. no. or transaction ID from your receipt"
              placeholderTextColor={colors.muted2}
            />

            <Text style={[styles.label, styles.mt]}>Payment screenshot</Text>
            <Pressable style={styles.proofBtn} onPress={() => void pickProof()}>
              <Ionicons name="image-outline" size={20} color={colors.navy} />
              <Text style={styles.proofBtnTxt}>{proof ? "Change image" : "Attach screenshot"}</Text>
            </Pressable>
            {proof ? <Image source={{ uri: proof.uri }} style={styles.proofPrev} /> : null}
          </>
        )}
      </GlassPanel>

      <View style={{ marginTop: 14, paddingBottom: 14 }}>
        {submitMsg ? (
          <View style={styles.submitMsgBox}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.submitMsgText}>{submitMsg}</Text>
          </View>
        ) : null}
        <Pressable
          style={({ pressed }) => [styles.btn, (sending || pressed) && { opacity: 0.92 }, sending && { opacity: 0.7 }]}
          disabled={sending}
          onPress={() => {
            void (async () => {
              try {
                await submit();
              } catch (e) {
                console.error("[booking] submit failed", e);
                setSubmitMsg(e instanceof Error ? e.message : "Something went wrong. Please try again.");
              }
            })();
          }}
        >
          <Text style={styles.btnTxt}>{sending ? "Submitting…" : "Submit reservation"}</Text>
        </Pressable>
      </View>

      </ScrollView>

      {androidDateJob && Platform.OS === "android" ? (
        <DateTimePicker
          value={androidDateJob.value}
          mode="date"
          display="default"
          onChange={(event, selected) => {
            setAndroidDateJob((job) => {
              if (!job) return null;
              if (event.type === "set" && selected) {
                const ymd = formatYmdFromDate(selected);
                if (job.which === "checkin") setCheckIn(ymd);
                else setCheckOut(ymd);
              }
              return null;
            });
          }}
        />
      ) : null}

      <Modal
        visible={iosDateModal != null}
        transparent
        animationType="fade"
        onRequestClose={() => setIosDateModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIosDateModal(null)} />
        <View style={styles.modalSheetWrap} pointerEvents="box-none">
          <GlassPanel style={styles.modalSheet} contentStyle={styles.modalSheetInner} borderRadius={22} intensity={66}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {iosDateModal === "checkin"
                  ? "Check-in date"
                  : iosDateModal === "checkout"
                    ? "Check-out date"
                    : "Date"}
              </Text>
              <Pressable style={styles.modalClose} onPress={() => setIosDateModal(null)}>
                <Ionicons name="close" size={22} color={colors.navy} />
              </Pressable>
            </View>
            {iosDateModal ? (
              <DateTimePicker
                value={iosPickDate}
                mode="date"
                display="spinner"
                themeVariant="light"
                onChange={(_, d) => {
                  if (d) setIosPickDate(d);
                }}
              />
            ) : null}
            <Pressable
              style={[styles.doneBtnPrimary, { marginTop: 8 }]}
              onPress={() => {
                if (!iosDateModal) return;
                const ymd = formatYmdFromDate(iosPickDate);
                if (iosDateModal === "checkin") setCheckIn(ymd);
                else setCheckOut(ymd);
                setIosDateModal(null);
              }}
            >
              <Text style={styles.doneBtnPrimaryTxt}>Done</Text>
            </Pressable>
          </GlassPanel>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.pageBg },
  page: { flex: 1, backgroundColor: colors.pageBg },
  center: { justifyContent: "center", alignItems: "center" },
  headerCard: { marginTop: 6 },
  headerCardInner: { padding: 16 },
  title: { fontSize: 22, fontWeight: "900", color: colors.navy, letterSpacing: 0.2 },
  sub: { marginTop: 6, fontSize: 15.5, fontWeight: "700", color: colors.primaryTeal },
  hint: { marginTop: 12, fontSize: 14, color: colors.muted, lineHeight: 20 },
  infoBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(11,184,196,0.35)",
    backgroundColor: "rgba(11,184,196,0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: { flex: 1, fontSize: 13.5, fontWeight: "700", color: colors.navy, lineHeight: 18 },
  warn: { marginTop: 12, color: colors.danger, fontWeight: "600" },
  muted: { color: colors.muted },
  mutedSmall: { marginTop: 8, fontSize: 13, color: colors.muted, lineHeight: 18 },
  card: { marginTop: 14 },
  cardInner: { padding: 14 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: "700", color: colors.muted2 },
  mtSm: { marginTop: 10 },
  tripBlock: { marginTop: 14 },
  tripRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  tripBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.58)",
    backgroundColor: "rgba(255,255,255,0.22)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tripBtnOn: { backgroundColor: colors.primaryTeal, borderColor: colors.primaryTeal },
  tripTxt: { fontSize: 14, fontWeight: "800", color: colors.navy },
  tripTxtOn: { color: "#fff" },
  mt: { marginTop: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.navy },
  grid2: { flexDirection: "row", gap: 10 },
  inputSm: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.64)",
    padding: 12,
    fontSize: 15,
    backgroundColor: "rgba(255,255,255,0.22)",
    color: colors.text,
  },
  dateFieldBtn: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.64)",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  dateFieldPlaceholder: {
    color: colors.muted2,
    fontWeight: "600",
  },
  arrivalCombo: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "stretch",
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.64)",
    backgroundColor: "rgba(255,255,255,0.22)",
    overflow: "hidden",
  },
  arrivalWrap: {
    alignSelf: "flex-start",
  },
  arrivalComboHour: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  arrivalComboMeridiem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  arrivalComboPressed: {
    backgroundColor: "rgba(11,184,196,0.12)",
  },
  arrivalComboText: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: 0.3,
  },
  inputLg: {
    marginTop: 6,
    minHeight: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.64)",
    padding: 12,
    fontSize: 15,
    backgroundColor: "rgba(255,255,255,0.22)",
    color: colors.text,
    textAlignVertical: "top",
  },
  choice: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.56)",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  choiceOn: { borderColor: "rgba(11,184,196,0.70)", backgroundColor: "rgba(11,184,196,0.10)" },
  choiceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  choiceTitle: { fontSize: 15, fontWeight: "700", color: colors.navy },
  choiceMeta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  dropdownBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.64)",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  dropdownBtnCompact: {
    marginTop: 6,
  },
  dropdownValue: { fontSize: 15, fontWeight: "800", color: colors.navy },
  dropdownHint: { marginTop: 3, fontSize: 12.5, color: colors.muted },
  guestInputWrap: {
    justifyContent: "space-between",
  },
  guestInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: "900",
    color: colors.navy,
    paddingVertical: 0,
  },
  guestSuffix: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Darker overlay so modal content stays readable.
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  doneModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  modalSheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 16,
  },
  modalSheet: {
    width: "100%",
    // Make the glass panel less see-through for readability.
    backgroundColor: "rgba(255,255,255,0.90)",
  },
  modalSheetInner: { padding: 14 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: "900", color: colors.navy },
  modalClose: { padding: 6, borderRadius: 999 },
  doneWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  /** Solid card (no blur) — avoids Android/Web blur “noise” artifacts behind text. */
  doneCardSolid: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  },
  doneIconSolid: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryTeal,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  doneTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.navy,
    textAlign: "center",
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  doneText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 21,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  doneBtns: { marginTop: 24, gap: 12, width: "100%" },
  doneBtnPrimary: {
    backgroundColor: colors.primaryTeal,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    width: "100%",
  },
  doneBtnPrimaryTxt: { color: "#fff", fontWeight: "900", fontSize: 15 },
  doneBtnGhost: {
    borderWidth: 1.5,
    borderColor: "rgba(15, 23, 42, 0.14)",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    width: "100%",
  },
  doneBtnGhostTxt: { color: colors.navy, fontWeight: "800", fontSize: 15 },
  doneBtnPressed: { opacity: 0.88 },
  summaryLine: { fontSize: 13, color: colors.text, lineHeight: 18 },
  totalRow: { marginTop: 10, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  summaryTotalLbl: { fontSize: 13, fontWeight: "800", color: colors.muted2 },
  summaryTotal: { fontSize: 18, fontWeight: "900", color: colors.navy },
  downpayBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(11,184,196,0.14)",
    borderWidth: 1,
    borderColor: "rgba(11,184,196,0.40)",
    alignItems: "center",
  },
  downpayK: { fontSize: 14, fontWeight: "900", color: colors.navy },
  downpayV: { marginTop: 4, fontSize: 22, fontWeight: "900", color: colors.primaryTeal },
  payCardsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  payCard: {
    flex: 1,
    minWidth: 0,
    maxHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.56)",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  payCardOn: {
    borderColor: "rgba(11,184,196,0.95)",
    backgroundColor: "rgba(11,184,196,0.12)",
  },
  payCardLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  payCardLogoImg: {
    width: 34,
    height: 34,
  },
  qrBlock: { marginTop: 12, alignItems: "center" },
  qrHint: { fontSize: 14, fontWeight: "600", color: colors.navy, marginTop: 6, textAlign: "center" },
  qrImg: { width: 200, height: 200, marginTop: 8, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.34)" },
  proofBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.60)",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  proofBtnTxt: { fontWeight: "700", color: colors.navy },
  proofPrev: { marginTop: 10, width: "100%", height: 180, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.06)" },
  submitMsgBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(220, 53, 69, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(220, 53, 69, 0.22)",
    marginBottom: 10,
  },
  submitMsgText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: "700",
    color: colors.danger,
  },
  btn: {
    backgroundColor: colors.primaryTeal,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  btnTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
