const PH_TZ = "Asia/Manila";

export type PhHoliday = {
  id: string;
  name: string;
  ymd: string; // YYYY-MM-DD (PH calendar date)
  kind: "regular" | "special";
};

function ymdToNum(ymd: string): number | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function phTodayYmd(): string | null {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: PH_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = dtf.formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // ignore
  }
  return null;
}

function phYear(): number {
  const ymd = phTodayYmd();
  const y = ymd ? Number(ymd.slice(0, 4)) : NaN;
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

function lastMondayOfAugustYmd(year: number): string {
  const lastDay = new Date(Date.UTC(year, 7 /* Aug */, 31));
  const dow = lastDay.getUTCDay(); // 0 Sun ... 1 Mon ... 6 Sat
  const delta = (dow + 6) % 7; // days since Monday
  const monday = new Date(Date.UTC(year, 7, 31 - delta));
  const m = monday.getUTCMonth() + 1;
  const d = monday.getUTCDate();
  return `${year}-${pad2(m)}-${pad2(d)}`;
}

function fixed(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function phHolidayCalendar(year = phYear()): PhHoliday[] {
  const holidays: PhHoliday[] = [
    { id: `ph-new-year-${year}`, name: "New Year's Day", ymd: fixed(year, 1, 1), kind: "regular" },
    { id: `ph-edsa-${year}`, name: "EDSA People Power Revolution", ymd: fixed(year, 2, 25), kind: "special" },
    { id: `ph-araw-ng-kagitingan-${year}`, name: "Araw ng Kagitingan", ymd: fixed(year, 4, 9), kind: "regular" },
    { id: `ph-labor-day-${year}`, name: "Labor Day", ymd: fixed(year, 5, 1), kind: "regular" },
    { id: `ph-independence-${year}`, name: "Independence Day", ymd: fixed(year, 6, 12), kind: "regular" },
    { id: `ph-ninoy-${year}`, name: "Ninoy Aquino Day", ymd: fixed(year, 8, 21), kind: "special" },
    { id: `ph-national-heroes-${year}`, name: "National Heroes Day", ymd: lastMondayOfAugustYmd(year), kind: "regular" },
    { id: `ph-all-saints-${year}`, name: "All Saints' Day", ymd: fixed(year, 11, 1), kind: "special" },
    { id: `ph-bonifacio-${year}`, name: "Bonifacio Day", ymd: fixed(year, 11, 30), kind: "regular" },
    { id: `ph-immaculate-${year}`, name: "Feast of the Immaculate Conception", ymd: fixed(year, 12, 8), kind: "special" },
    { id: `ph-christmas-${year}`, name: "Christmas Day", ymd: fixed(year, 12, 25), kind: "regular" },
    { id: `ph-rizal-${year}`, name: "Rizal Day", ymd: fixed(year, 12, 30), kind: "regular" },
    { id: `ph-new-years-eve-${year}`, name: "New Year's Eve", ymd: fixed(year, 12, 31), kind: "special" },
  ];

  holidays.sort((a, b) => (ymdToNum(a.ymd) ?? 0) - (ymdToNum(b.ymd) ?? 0));
  return holidays;
}

export function phCurrentOrNextHoliday(
  now = new Date(),
  opts?: { windowDays?: number },
): { holiday: PhHoliday; isToday: boolean } | null {
  const windowDays = Math.max(0, Math.floor(opts?.windowDays ?? 10));

  let todayYmd: string | null = null;
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: PH_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = dtf.formatToParts(now);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) todayYmd = `${y}-${m}-${d}`;
  } catch {
    // ignore
  }

  if (!todayYmd) return null;
  const todayNum = ymdToNum(todayYmd);
  if (todayNum == null) return null;

  const year = Number(todayYmd.slice(0, 4));
  const list = [...phHolidayCalendar(year), ...phHolidayCalendar(year + 1)];

  const todayDate = new Date(`${todayYmd}T12:00:00+08:00`);
  const windowEnd = new Date(todayDate.getTime() + windowDays * 24 * 60 * 60 * 1000);
  const windowEndYmd = (() => {
    try {
      const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone: PH_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const parts = dtf.formatToParts(windowEnd);
      const y = parts.find((p) => p.type === "year")?.value;
      const m = parts.find((p) => p.type === "month")?.value;
      const d = parts.find((p) => p.type === "day")?.value;
      if (y && m && d) return `${y}-${m}-${d}`;
    } catch {
      // ignore
    }
    return null;
  })();
  const endNum = windowEndYmd ? ymdToNum(windowEndYmd) : null;

  for (const h of list) {
    const n = ymdToNum(h.ymd);
    if (n == null) continue;
    if (n < todayNum) continue;
    if (endNum != null && n > endNum) return null;
    return { holiday: h, isToday: n === todayNum };
  }

  return null;
}

export function formatPhHolidayShort(ymd: string): string {
  const u = ymd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(u)) return ymd.trim();
  try {
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: PH_TZ,
      month: "short",
      day: "numeric",
    }).format(new Date(`${u}T12:00:00+08:00`));
  } catch {
    return u;
  }
}

