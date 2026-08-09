"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useBrand } from "@/components/brand/BrandProvider";
import { WOMENS_MONTH_COPY } from "@/lib/brand";

/**
 * The dashboard's Women's Month note, shown only while the WoAcademy identity
 * is active. Dismissal is keyed to the year, so it stays dismissed for the rest
 * of this August and returns on its own next August.
 */
export function WomensMonthBanner() {
  const brand = useBrand();
  const [dismissed, setDismissed] = useState(true); // assume hidden until read
  const [ready, setReady] = useState(false);
  const key = `moacademy.womensMonth.dismissed.${new Date().getFullYear()}`;

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(key) === "1");
    } catch {
      setDismissed(false);
    }
    setReady(true);
  }, [key]);

  if (!brand.womensMonth || !ready || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* private mode — it'll just show again next visit */
    }
  }

  return (
    <div className="mb-5 flex flex-wrap items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brand.mark} alt="" className="mt-0.5 h-5 w-auto shrink-0" />
      <p className="flex-1">
        <span className="font-semibold">{WOMENS_MONTH_COPY.title}</span>{" "}
        {WOMENS_MONTH_COPY.blurb}
      </p>
      <button
        onClick={dismiss}
        aria-label="Dismiss the Women's Month note"
        className="focus-ring -mr-1 -mt-1 rounded-lg p-1.5 text-brand-700 hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-brand-500/20"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
