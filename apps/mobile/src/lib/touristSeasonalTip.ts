/** Calendar tip for travelers (Philippines-oriented seasons / holidays). Not tied to a single listing. */
export type TouristSeasonalTip = {
  id: string;
  title: string;
  body: string;
};

import { formatPhHolidayShort, phCurrentOrNextHoliday } from "./phHolidays";

export function activeTouristSeasonalTip(now = new Date()): TouristSeasonalTip | null {
  const next = phCurrentOrNextHoliday(now);
  if (next) {
    return {
      id: next.holiday.id,
      title: next.isToday ? `${next.holiday.name} (Today)` : next.holiday.name,
      body:
        next.isToday
          ? "Holiday today—expect schedule changes. Check opening hours and promos before you go."
          : `Next holiday: ${next.holiday.name} (${formatPhHolidayShort(next.holiday.ymd)}). Check opening hours and promos.`,
    };
  }

  const tips: Array<TouristSeasonalTip & { start: [number, number]; end: [number, number] }> = [
    {
      id: "summer-travel",
      title: "Summer trips",
      body:
        "Peak beach and provincial visits June–August. Read each place’s advisory for crowds, fees, and weather tips.",
      start: [6, 1],
      end: [8, 31],
    },
    {
      id: "ber-months",
      title: "Ber months getaways",
      body:
        "September onward is reunion and holiday planning season. Favorites with active promos are highlighted in Explore.",
      start: [9, 1],
      end: [11, 30],
    },
    {
      id: "holiday-peak",
      title: "Holiday peak",
      body:
        "December & New Year mean busy resorts and restaurants. Reserve ahead and watch for owner advisories on hours.",
      start: [12, 1],
      end: [1, 15],
    },
  ];

  const m = now.getMonth() + 1;
  const d = now.getDate();
  const cur = m * 100 + d;
  for (const t of tips) {
    const s = t.start[0] * 100 + t.start[1];
    const e = t.end[0] * 100 + t.end[1];
    const ok = s <= e ? cur >= s && cur <= e : cur >= s || cur <= e;
    if (ok) return { id: t.id, title: t.title, body: t.body };
  }
  return null;
}
