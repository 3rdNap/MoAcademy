// Seasonal branding.
//
// August is Women's Month in South Africa (National Women's Day falls on the
// 9th), and for that month the academy runs as **WoAcademy**: the "wo" mark,
// a lilac palette, and Wo — the same she/her AI tutor — in place of Mo. On
// 1 September it returns to the year-round blue MoAcademy on its own.
//
// One rule decides it, and everything else reads from the resolved `Brand`, so
// the switch is a date check rather than a scattered set of string edits.

/** The month South Africa observes as Women's Month. */
export const WOMENS_MONTH = 8; // August

/**
 * The month (1–12) `date` falls in, in South African Standard Time.
 *
 * SAST is UTC+2 all year — South Africa has not observed daylight saving since
 * 1944 — so shifting by a fixed offset is exact, and avoids depending on the
 * host having full ICU time-zone data.
 */
function southAfricanMonth(date: Date): number {
  return new Date(date.getTime() + 2 * 60 * 60 * 1000).getUTCMonth() + 1;
}

/** Whether `date` falls inside South Africa's Women's Month. */
export function isWomensMonth(date: Date = new Date()): boolean {
  return southAfricanMonth(date) === WOMENS_MONTH;
}

export interface Brand {
  /** Stable identifier for the active identity. */
  key: "moacademy" | "woacademy";
  /** The wordmark, as it appears in copy. */
  name: string;
  /** The AI tutor's name — she is Mo year-round, Wo in August. */
  assistant: string;
  /** Logo mark: global nav, auth card, the tutor's avatar. */
  mark: string;
  /** Installed-app icons and the social share card. */
  icon192: string;
  icon512: string;
  ogImage: string;
  /** Class applied to <html>; swaps the brand palette in globals.css. */
  htmlClass: string;
  /** True while the Women's Month identity is active. */
  womensMonth: boolean;
}

const MOACADEMY: Brand = {
  key: "moacademy",
  name: "MoAcademy",
  assistant: "Mo",
  mark: "/mo-mark.png",
  icon192: "/icon-192.png",
  icon512: "/icon-512.png",
  ogImage: "/og-image.png",
  htmlClass: "",
  womensMonth: false,
};

const WOACADEMY: Brand = {
  key: "woacademy",
  name: "WoAcademy",
  assistant: "Wo",
  mark: "/wo-mark.png",
  icon192: "/wo-icon-192.png",
  icon512: "/wo-icon-512.png",
  ogImage: "/wo-og-image.png",
  htmlClass: "womens-month",
  womensMonth: true,
};

/**
 * The identity to render for `date` (defaults to now).
 *
 * `NEXT_PUBLIC_BRAND=woacademy|moacademy` pins it, so either identity can be
 * previewed or screenshotted out of season without waiting for the calendar.
 * Leave it unset in production — then the date alone decides.
 */
export function getBrand(date: Date = new Date()): Brand {
  const pinned = process.env.NEXT_PUBLIC_BRAND;
  if (pinned === "woacademy") return WOACADEMY;
  if (pinned === "moacademy") return MOACADEMY;
  return isWomensMonth(date) ? WOACADEMY : MOACADEMY;
}

/** Both identities, for tests and for pre-rendering the alternate assets. */
export const BRANDS = { moacademy: MOACADEMY, woacademy: WOACADEMY } as const;

/** Women's Month copy, kept in one place so the wording stays consistent. */
export const WOMENS_MONTH_COPY = {
  title: "Women's Month",
  /** Shown in the dashboard banner. */
  blurb:
    "August is Women's Month in South Africa, marking the 1956 march to the " +
    "Union Buildings. We're WoAcademy for the month in honour of it.",
  /** National Women's Day. */
  dayLabel: "National Women's Day",
  dayIso: "-08-09",
} as const;
