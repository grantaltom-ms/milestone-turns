"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";
import { upsertProfileAction } from "@/app/actions";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<Shell />}>
      <OnboardingForm />
    </Suspense>
  );
}

function Shell({ children }: { children?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        background: "#1A2E44",
        padding: "60px 24px 40px",
        maxWidth: 400,
        margin: "0 auto",
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
          Welcome!
        </div>
        <p style={{ fontWeight: 300, fontSize: 14, color: "rgba(245,241,232,0.55)", margin: 0 }}>
          One quick thing before you get started.
        </p>
      </div>
      {children}
    </div>
  );
}

function OnboardingForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/";

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter your name."); return; }
    setError(null);
    startTransition(async () => {
      try {
        await upsertProfileAction({ name });
        router.replace(next);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save your name.");
      }
    });
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontWeight: 500,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "rgba(245,241,232,0.65)",
    marginBottom: 7,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1.5px solid rgba(245,241,232,0.18)",
    borderRadius: 8,
    padding: "13px 14px",
    fontSize: 15,
    color: "#F5F1E8",
    background: "rgba(255,255,255,0.06)",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <Shell>
      <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label>
          <span style={labelStyle}>Your name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            autoComplete="name"
            placeholder="e.g. Jordan Smith"
            required
            style={inputStyle}
          />
        </label>
        <p style={{ margin: 0, fontSize: 12.5, color: "rgba(245,241,232,0.4)", lineHeight: 1.5 }}>
          This is how you&apos;ll appear in task assignments. Your initials are auto-generated.
        </p>

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
          disabled={pending}
          style={{
            width: "100%",
            padding: "15px",
            borderRadius: 8,
            border: "none",
            cursor: pending ? "wait" : "pointer",
            background: "#2E6B5E",
            color: "#fff",
            fontWeight: 600,
            fontSize: 15,
            opacity: pending ? 0.75 : 1,
          }}
        >
          {pending ? "Saving…" : "Get started →"}
        </button>
      </form>
    </Shell>
  );
}
