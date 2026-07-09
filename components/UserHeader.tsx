"use client";

import { useTransition } from "react";
import { setLanguageAction, signOutAction } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { useLocale, useT } from "@/lib/i18n-context";
import type { Profile } from "@/lib/supabase/types";

export function UserHeader({ profile }: { profile: Profile }) {
  const [pending, startTransition] = useTransition();
  const [langPending, startLangTransition] = useTransition();
  const { t } = useT();
  const locale = useLocale();
  const next = locale === "es" ? "en" : "es";

  function signOut() {
    startTransition(() => { void signOutAction(); });
  }

  function toggleLanguage() {
    startLangTransition(() => { void setLanguageAction(next); });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Avatar initials={profile.initials} size={28} color={profile.avatar_color} />
      <button
        type="button"
        onClick={toggleLanguage}
        disabled={langPending}
        title={next === "es" ? t("lang.toSpanish") : t("lang.toEnglish")}
        aria-label={next === "es" ? t("lang.toSpanish") : t("lang.toEnglish")}
        style={{
          background: "transparent",
          border: "1px solid rgba(245,241,232,0.22)",
          borderRadius: 6,
          padding: "4px 8px",
          color: "rgba(245,241,232,0.7)",
          fontSize: 11.5,
          cursor: langPending ? "wait" : "pointer",
          fontWeight: 700,
          letterSpacing: "0.06em",
        }}
      >
        {langPending ? "…" : (next === "es" ? "ES" : "EN")}
      </button>
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        title={t("common.signOut")}
        style={{
          background: "transparent",
          border: "1px solid rgba(245,241,232,0.22)",
          borderRadius: 6,
          padding: "4px 9px",
          color: "rgba(245,241,232,0.55)",
          fontSize: 11.5,
          cursor: pending ? "wait" : "pointer",
          fontWeight: 500,
          letterSpacing: "0.03em",
        }}
      >
        {pending ? "…" : t("common.signOut")}
      </button>
    </div>
  );
}
