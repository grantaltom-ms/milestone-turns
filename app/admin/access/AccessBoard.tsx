"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import type { ProfileMember } from "@/lib/stages";
import type { PropertyRow } from "@/lib/supabase/types";
import { setUserBuildingsAction } from "./actions";

function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

export function AccessBoard({
  users,
  buildings,
  access,
}: {
  users: ProfileMember[];
  buildings: PropertyRow[];
  access: Record<string, number[]>;
}) {
  // Current selection + the last-saved baseline, both keyed by user id.
  const [sel, setSel] = useState<Record<string, number[]>>(
    () => Object.fromEntries(users.map((u) => [u.id, access[u.id] ?? []])),
  );
  const [baseline, setBaseline] = useState<Record<string, number[]>>(
    () => Object.fromEntries(users.map((u) => [u.id, access[u.id] ?? []])),
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return buildings;
    return buildings.filter((b) => b.name.toLowerCase().includes(q));
  }, [buildings, search]);

  function toggleBuilding(userId: string, id: number) {
    setSel((prev) => {
      const cur = new Set(prev[userId] ?? []);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      return { ...prev, [userId]: [...cur] };
    });
  }

  function setForUser(userId: string, ids: number[]) {
    setSel((prev) => ({ ...prev, [userId]: ids }));
  }

  function save(userId: string) {
    setSavingId(userId);
    const ids = sel[userId] ?? [];
    startTransition(async () => {
      try {
        await setUserBuildingsAction(userId, ids);
        setBaseline((prev) => ({ ...prev, [userId]: ids }));
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
          Building access
        </h1>
        <p style={{ fontWeight: 300, fontSize: 13, color: "rgba(245,241,232,0.6)", marginTop: 4, lineHeight: 1.45 }}>
          Limit which buildings each person sees. Leave someone with no buildings
          selected and they see everything. Admins always see all.
        </p>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 40px", background: "#F5F1E8" }}>
        {users.map((u) => {
          const isAdmin = (u.role as string) === "admin";
          const selected = sel[u.id] ?? [];
          const base = baseline[u.id] ?? [];
          const dirty = !sameSet(selected, base);
          const open = openId === u.id;
          const summary = isAdmin
            ? "All buildings · admin"
            : selected.length === 0
              ? "All buildings"
              : `${selected.length} building${selected.length !== 1 ? "s" : ""}`;

          return (
            <div key={u.id} style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(11,27,43,0.09)", marginBottom: 10, overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => { if (!isAdmin) { setOpenId(open ? null : u.id); setSearch(""); } }}
                aria-expanded={open}
                style={{
                  display: "flex", alignItems: "center", gap: 11, width: "100%",
                  padding: "12px 14px", background: "transparent", border: "none",
                  cursor: isAdmin ? "default" : "pointer", textAlign: "left",
                }}
              >
                <Avatar initials={u.initials} size={30} color={u.avatar_color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: "#0B1B2B" }}>{u.name}</div>
                  <div style={{ fontWeight: 400, fontSize: 12, color: "rgba(11,27,43,0.5)", textTransform: "capitalize" }}>
                    {u.role.replace("_", " ")}
                  </div>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: selected.length === 0 || isAdmin ? "rgba(11,27,43,0.45)" : "#2E6B5E", whiteSpace: "nowrap" }}>
                  {summary}
                </span>
                {!isAdmin && (
                  <span aria-hidden="true" style={{ fontSize: 11, color: "rgba(11,27,43,0.4)", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▸</span>
                )}
              </button>

              {open && !isAdmin && (
                <div style={{ borderTop: "1px solid rgba(11,27,43,0.07)", padding: "10px 12px 12px" }}>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search buildings…"
                    style={{
                      width: "100%", boxSizing: "border-box", padding: "8px 11px", borderRadius: 8,
                      border: "1px solid rgba(11,27,43,0.15)", background: "#fff", fontSize: 13.5,
                      color: "#0B1B2B", outline: "none", marginBottom: 8,
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <button type="button" onClick={() => setForUser(u.id, Array.from(new Set([...(sel[u.id] ?? []), ...filtered.map((b) => b.id)])))}
                      style={pillBtn}>Select shown</button>
                    <button type="button" onClick={() => setForUser(u.id, [])} style={pillBtn}>Clear all</button>
                  </div>

                  <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid rgba(11,27,43,0.06)", borderRadius: 8 }}>
                    {filtered.length === 0 ? (
                      <div style={{ padding: 12, fontSize: 13, color: "rgba(11,27,43,0.5)" }}>No buildings match.</div>
                    ) : (
                      filtered.map((b) => {
                        const on = (sel[u.id] ?? []).includes(b.id);
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => toggleBuilding(u.id, b.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: 10, width: "100%",
                              padding: "9px 12px", background: "transparent", border: "none",
                              borderBottom: "1px solid rgba(11,27,43,0.05)", cursor: "pointer", textAlign: "left",
                            }}
                          >
                            <span style={{
                              width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                              border: `2px solid ${on ? "#2E6B5E" : "rgba(11,27,43,0.25)"}`,
                              background: on ? "#2E6B5E" : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {on && (
                                <svg width="11" height="8" viewBox="0 0 12 9"><path d="M1 4l3.5 3.5L11 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                              )}
                            </span>
                            <span style={{ fontSize: 13.5, color: "#0B1B2B" }}>{b.name}</span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => save(u.id)}
                      disabled={!dirty || savingId === u.id}
                      style={{
                        padding: "9px 16px", borderRadius: 8, border: "none",
                        background: dirty && savingId !== u.id ? "#2E6B5E" : "rgba(11,27,43,0.1)",
                        color: dirty && savingId !== u.id ? "#fff" : "rgba(11,27,43,0.35)",
                        fontWeight: 600, fontSize: 13.5, cursor: dirty && savingId !== u.id ? "pointer" : "not-allowed",
                      }}
                    >
                      {savingId === u.id ? "Saving…" : "Save"}
                    </button>
                    <span style={{ fontSize: 12, color: "rgba(11,27,43,0.5)" }}>
                      {(sel[u.id] ?? []).length === 0 ? "Sees all buildings" : `${(sel[u.id] ?? []).length} selected`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const pillBtn: React.CSSProperties = {
  padding: "5px 11px", borderRadius: 999, border: "1px solid rgba(11,27,43,0.18)",
  background: "transparent", color: "rgba(11,27,43,0.65)", fontSize: 12, fontWeight: 500, cursor: "pointer",
};
