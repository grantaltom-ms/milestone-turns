"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { loadPublicProfilesAction, loginAsUserAction, type PublicProfile } from "./actions";

export default function LoginPage() {
  return (
    <Suspense fallback={<Shell />}>
      <LoginForm />
    </Suspense>
  );
}

function Shell({ children }: { children?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#1A2E44",
        padding: "60px 24px 40px",
        maxWidth: 400,
        margin: "0 auto",
        boxSizing: "border-box",
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 26,
            color: "#F5F1E8",
            letterSpacing: "-0.01em",
            marginBottom: 6,
          }}
        >
          Milestone Turns
        </div>
        <p style={{ fontWeight: 300, fontSize: 14, color: "rgba(245,241,232,0.55)", margin: 0 }}>
          Find your name below to sign in.
        </p>
      </div>
      {children}
    </div>
  );
}

// Which role groups appear under each dropdown, and its header label.
const GROUPS: { key: string; label: string; roles: PublicProfile["role"][] }[] = [
  { key: "maintenance", label: "Maintenance", roles: ["maintenance_lead", "maintenance"] },
  { key: "managers", label: "Managers", roles: ["office_lead", "office", "admin"] },
  { key: "vendors", label: "Vendors", roles: ["vendor"] },
];

function RoleSelect({
  label,
  profiles,
  value,
  onChange,
}: {
  label: string;
  profiles: PublicProfile[];
  value: string;
  onChange: (id: string) => void;
}) {
  const selectStyle: React.CSSProperties = {
    width: "100%",
    border: "1.5px solid rgba(245,241,232,0.18)",
    borderRadius: 8,
    padding: "13px 14px",
    fontSize: 15,
    color: value ? "#F5F1E8" : "rgba(245,241,232,0.4)",
    background: "rgba(255,255,255,0.06)",
    outline: "none",
    boxSizing: "border-box",
    appearance: "none",
    cursor: profiles.length > 0 ? "pointer" : "not-allowed",
  };

  return (
    <label>
      <span
        style={{
          display: "block",
          fontWeight: 500,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "rgba(245,241,232,0.65)",
          marginBottom: 7,
        }}
      >
        {label}
      </span>
      <div style={{ position: "relative" }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={profiles.length === 0}
          style={selectStyle}
        >
          <option value="" disabled style={{ background: "#1A2E44", color: "rgba(245,241,232,0.4)" }}>
            {profiles.length > 0 ? "Select your name…" : "None yet"}
          </option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id} style={{ background: "#1A2E44", color: "#F5F1E8" }}>
              {p.name}
            </option>
          ))}
        </select>
        {/* chevron */}
        <svg
          width="14" height="14"
          viewBox="0 0 16 16"
          fill="rgba(245,241,232,0.5)"
          style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
        >
          <path d="M4 6l4 4 4-4" stroke="rgba(245,241,232,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
    </label>
  );
}

function LoginForm() {
  const search = useSearchParams();
  const next = search.get("next") ?? "/";

  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  // One selection id per group — picking in one clears the other two, so
  // exactly one profile is ever selected at a time across all three menus.
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    loadPublicProfilesAction().then(setProfiles);
  }, []);

  const selected = GROUPS.map((g) => selections[g.key]).find(Boolean) ?? "";

  function selectIn(groupKey: string, id: string) {
    setSelections({ [groupKey]: id });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);

    startTransition(async () => {
      try {
        const { token_hash } = await loginAsUserAction(selected);
        const supabase = getBrowserSupabase();
        const { error: verifyErr } = await supabase.auth.verifyOtp({
          token_hash,
          type: "email",
        });
        if (verifyErr) throw verifyErr;
        window.location.href = next;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign in failed. Try again.");
      }
    });
  }

  return (
    <Shell>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {GROUPS.map((g) => (
          <RoleSelect
            key={g.key}
            label={g.label}
            profiles={profiles.filter((p) => g.roles.includes(p.role))}
            value={selections[g.key] ?? ""}
            onChange={(id) => selectIn(g.key, id)}
          />
        ))}

        {error && (
          <div
            style={{
              padding: "11px 13px",
              background: "rgba(196,92,59,0.15)",
              border: "1px solid rgba(196,92,59,0.4)",
              borderRadius: 8,
              fontSize: 13.5,
              color: "#F5A08A",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending || !selected}
          style={{
            width: "100%",
            padding: "15px",
            borderRadius: 8,
            border: "none",
            cursor: pending || !selected ? "default" : "pointer",
            background: "#2E6B5E",
            color: "#fff",
            fontWeight: 600,
            fontSize: 15,
            opacity: pending || !selected ? 0.5 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </Shell>
  );
}
