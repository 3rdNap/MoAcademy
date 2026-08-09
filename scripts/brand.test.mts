import { isWomensMonth, getBrand } from "../src/lib/brand.ts";

const cases: [string, boolean, string][] = [
  ["2026-08-09T10:00:00Z", true,  "National Women's Day, midday SAST"],
  ["2026-08-01T00:00:00Z", true,  "1 Aug 02:00 SAST"],
  ["2026-07-31T21:59:59Z", false, "31 Jul 23:59 SAST — still July"],
  ["2026-07-31T22:00:00Z", true,  "1 Aug 00:00 SAST — switch ON at SA midnight"],
  ["2026-08-31T21:59:59Z", true,  "31 Aug 23:59 SAST — last minute"],
  ["2026-08-31T22:00:00Z", false, "1 Sep 00:00 SAST — switch OFF at SA midnight"],
  ["2026-09-15T12:00:00Z", false, "September"],
  ["2027-08-15T12:00:00Z", true,  "recurs the next year"],
  ["2030-08-01T05:00:00Z", true,  "and every year after"],
  ["2026-01-09T12:00:00Z", false, "January"],
  ["2026-12-31T23:00:00Z", false, "New Year's Eve UTC (1 Jan SAST)"],
];

let fail = 0;
for (const [iso, want, why] of cases) {
  const got = isWomensMonth(new Date(iso));
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${iso}  ->  ${got ? "WoAcademy" : "MoAcademy"}   ${why}`);
}

// every month of a year: exactly one month on
const months = Array.from({length:12}, (_,i) =>
  isWomensMonth(new Date(Date.UTC(2026, i, 15, 12))));
const on = months.reduce((n,v)=>n+(v?1:0),0);
console.log(`\n  months active in 2026: ${on} (expect 1), index ${months.indexOf(true)} (expect 7 = August)`);
if (on !== 1 || months.indexOf(true) !== 7) fail++;

const b = getBrand(new Date("2026-08-09T10:00:00Z"));
console.log(`  August brand: ${b.name} / tutor ${b.assistant} / ${b.mark} / class "${b.htmlClass}"`);
const n = getBrand(new Date("2026-09-09T10:00:00Z"));
console.log(`  Sept  brand: ${n.name} / tutor ${n.assistant} / ${n.mark} / class "${n.htmlClass}"`);
if (b.name !== "WoAcademy" || n.name !== "MoAcademy") fail++;

console.log(fail ? `\n${fail} FAILURE(S)` : "\nall brand date checks passed");
process.exit(fail ? 1 : 0);
