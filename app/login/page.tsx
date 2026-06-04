"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginShell({ children }: { children?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#1A2E44",
        padding: "50px 20px",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 22,
          color: "#F5F1E8",
          letterSpacing: "-0.01em",
        }}
      >
        Sign in
      </h1>
      <p
        style={{
          fontWeight: 300,
          fontSize: 13,
          color: "rgba(245,241,232,0.58)",
          marginTop: 4,
          marginBottom: 24,
        }}
      >
        Milestone staff only.
      </p>
      {children}
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = getBrowserSupabase();
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (signInErr) {
      setError(signInErr.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontWeight: 500,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "rgba(245,241,232,0.7)",
    marginBottom: 7,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1.5px solid rgba(245,241,232,0.2)",
    borderRadius: 8,
    padding: "12px 13px",
    fontSize: 14.5,
    color: "#F5F1E8",
    background: "rgba(0,0,0,0.15)",
    outline: "none",
  };

  return (
    <LoginShell>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label>
          <span style={labelStyle}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            style={inputStyle}
          />
        </label>
        <label>
          <span style={labelStyle}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            style={inputStyle}
          />
        </label>

        {error && (
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(196,92,59,0.15)",
              border: "1px solid rgba(196,92,59,0.4)",
              borderRadius: 8,
              fontSize: 13,
              color: "#F5F1E8",
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
            padding: 15,
            borderRadius: 8,
            border: "none",
            cursor: pending ? "wait" : "pointer",
            background: "#2E6B5E",
            color: "#fff",
            fontWeight: 600,
            fontSize: 15,
            opacity: pending ? 0.8 : 1,
          }}
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </LoginShell>
  );
}
