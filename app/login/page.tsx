"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

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
          Milestone Turns
        </div>
        <p style={{ fontWeight: 300, fontSize: 14, color: "rgba(245,241,232,0.55)", margin: 0 }}>
          Team access only. Enter your email to sign in.
        </p>
      </div>
      {children}
    </div>
  );
}

function LoginForm() {
  const search = useSearchParams();
  const next = search.get("next") ?? "/";
  const errorParam = search.get("error");

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    errorParam === "auth_failed" ? "Sign-in link expired or invalid. Try again." :
    errorParam === "missing_code" ? "Something went wrong. Try again." : null
  );
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = getBrowserSupabase();
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
        : `/auth/callback`;

    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo },
    });

    setPending(false);
    if (otpErr) {
      setError(otpErr.message);
      return;
    }
    setSent(true);
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

  if (sent) {
    return (
      <Shell>
        <div
          style={{
            background: "rgba(46,107,94,0.18)",
            border: "1px solid rgba(91,174,151,0.35)",
            borderRadius: 10,
            padding: "20px 18px",
            color: "#A8D5C5",
            fontSize: 14.5,
            lineHeight: 1.55,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Check your email ✓</div>
          We sent a sign-in link to <strong style={{ color: "#F5F1E8" }}>{email}</strong>.
          <br /><br />
          Click the link in the email to continue. It expires in 1 hour.
        </div>
        <button
          type="button"
          onClick={() => setSent(false)}
          style={{
            marginTop: 16,
            background: "transparent",
            border: "1px solid rgba(245,241,232,0.2)",
            borderRadius: 8,
            padding: "11px 14px",
            color: "rgba(245,241,232,0.6)",
            fontSize: 13.5,
            cursor: "pointer",
            width: "100%",
          }}
        >
          Use a different email
        </button>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label>
          <span style={labelStyle}>Email address</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            required
            placeholder="you@example.com"
            style={inputStyle}
          />
        </label>

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
            transition: "opacity 0.15s",
          }}
        >
          {pending ? "Sending…" : "Send me a sign-in link"}
        </button>
      </form>
    </Shell>
  );
}
