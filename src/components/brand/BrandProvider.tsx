"use client";

import { createContext, useContext } from "react";
import { BRANDS, type Brand } from "@/lib/brand";

/**
 * The active identity, resolved once on the server (root layout) and handed to
 * the client. Client components read it from here rather than calling
 * getBrand() themselves: a page rendered just before 1 August and served from
 * the ISR cache just after would otherwise hydrate to a different answer than
 * it was rendered with. Sharing the server's value keeps the two in step, and
 * the layout's revalidate window bounds how long a stale one can survive.
 */
const BrandContext = createContext<Brand>(BRANDS.moacademy);

export function BrandProvider({
  brand,
  children,
}: {
  brand: Brand;
  children: React.ReactNode;
}) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

/** The active brand — "MoAcademy"/Mo year-round, "WoAcademy"/Wo in August. */
export function useBrand(): Brand {
  return useContext(BrandContext);
}
