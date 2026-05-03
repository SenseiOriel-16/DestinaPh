/** Calendar tip for travelers (Philippines-oriented seasons / holidays). Not tied to a single listing. */
export type TouristSeasonalTip = {
  id: string;
  title: string;
  body: string;
};

function calendarDayInRange(
  month: number,
  day: number,
  start: [number, number],
  end: [number, number],
): boolean {
  const cur = month * 100 + day;
  const s = start[0] * 100 + start[1];
  const e = end[0] * 100 + end[1];
  if (s <= e) return cur >= s && cur <= e;
  return cur >= s || cur <= e;
}

export function activeTouristSeasonalTip(now = new Date()): TouristSeasonalTip | null {
  const m = now.getMonth() + 1;
  const d = now.getDate();

  const tips: Array<TouristSeasonalTip & { start: [number, number]; end: [number, number] }> = [
    {
      id: "ph-labor-day",
      title: "Long weekend & Labor Day",
      body:
        "Many Filipinos travel around May 1. Book early, check listing promos, and confirm opening hours with the host.",
      start: [4, 26],
      end: [5, 5],
    },
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

  for (const t of tips) {
    if (calendarDayInRange(m, d, t.start, t.end)) {
      return { id: t.id, title: t.title, body: t.body };
    }
  }
  return null;
}
