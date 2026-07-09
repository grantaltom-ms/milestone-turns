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
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
      {/* Sign-out as icon to save header space */}
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        title={t("common.signOut")}
        aria-label={t("common.signOut")}
        style={{
          width: 30,
          height: 30,
          background: "transparent",
          border: "1px solid rgba(245,241,232,0.22)",
          borderRadius: "50%",
          color: "rgba(245,241,232,0.55)",
          cursor: pending ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {pending ? (
          <span style={{ fontSize: 11 }}>…</span>
        ) : (
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  );
}
