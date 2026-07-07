"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "@/lib/supabase/types";
import { tFor } from "@/lib/i18n";

const LocaleContext = createContext<Locale>("en");

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Returns { t, tp, stage } bound to the current user's locale. */
export function useT() {
  const locale = useContext(LocaleContext);
  return useMemo(() => tFor(locale), [locale]);
}
