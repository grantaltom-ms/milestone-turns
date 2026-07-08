"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import type { ProfileMember } from "@/lib/stages";
import { setUserSlackIdAction } from "./actions";

export function NotificationsBoard({ users }: { users: ProfileMember[] }) {
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(users.map((u) => [u.id, u.slack_user_id ?? ""])),
  );
  const [baseline, setBaseline] = useState<Record<string, string>>(
    () => Object.fromEntries(users.map((u) => [u.id, u.slack_user_id ?? ""])),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function save(userId: string) {
    setSavingId(userId);
    const value = values[userId] ?? "";
    startTransition(async () => {
      try {
        await setUserSlackIdAction(userId, value);
        setBaseline((prev) => ({ ...prev, [userId]: value }));
      } finally {
        setSavingId(null);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ background: "#1A2E44", padding: "50px 20px 16px", flexShrink: 0 }}>
        <Link href="/admin" style={{ color: "rgba(245,241,232,0.72)", fontWeight: 500, fontSize: 13.5, textDecoration: "none" }}>
          ← Admin
        </Link>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "#F5F1E8", marginTop: 8 }}>
          Slack notifications
        </h1>
        <p style={{ fontWeight: 300, fontSize: 13, color: "rgba(245,241,232,0.6)", marginTop: 4, lineHeight: 1.45 }}>
          Link each person&apos;s Slack member ID to DM them directly when they&apos;re
          assigned a task, handed a stage, or a unit is put on hold. Find it in
          Slack: profile photo → ⋮ → &quot;Copy member ID&quot;. Leave blank to use
          the shared fallback channel instead.
        </p>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 40px", background: "#F5F1E8" }}>
        {users.map((u) => {
          const value = values[u.id] ?? "";
          const dirty = value !== (baseline[u.id] ?? "");
          return (
            <div key={u.id} style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(11,27,43,0.09)", marginBottom: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
                <Avatar initials={u.initials} size={30} color={u.avatar_color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: "#0B1B2B" }}>{u.name}</div>
                  <div style={{ fontWeight: 400, fontSize: 12, color: "rgba(11,27,43,0.5)", textTransform: "capitalize" }}>
                    {u.role.replace("_", " ")}
                  </div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: value ? "#2E6B5E" : "rgba(11,27,43,0.4)" }}>
                  {value ? "Linked" : "Not linked"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValues((prev) => ({ ...prev, [u.id]: e.target.value }))}
                  placeholder="e.g. U0123ABCDEF"
                  style={{
                    flex: 1, boxSizing: "border-box", padding: "9px 11px", borderRadius: 8,
                    border: "1px solid rgba(11,27,43,0.15)", background: "#fff", fontSize: 13.5,
                    color: "#0B1B2B", outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => save(u.id)}
                  disabled={!dirty || savingId === u.id}
                  style={{
                    padding: "9px 16px", borderRadius: 8, border: "none", whiteSpace: "nowrap",
                    background: dirty && savingId !== u.id ? "#2E6B5E" : "rgba(11,27,43,0.1)",
                    color: dirty && savingId !== u.id ? "#fff" : "rgba(11,27,43,0.35)",
                    fontWeight: 600, fontSize: 13.5, cursor: dirty && savingId !== u.id ? "pointer" : "not-allowed",
                  }}
                >
                  {savingId === u.id ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
