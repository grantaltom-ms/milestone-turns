"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { AppfolioSyncSetting } from "@/lib/data";
import { upsertSyncSettingAction, createTurnFromAppfolioAction } from "./actions";

type VacantUnit = {
  property_id: number;       // AppFolio
  sb_property_id: number;    // Supabase
  property_name: string;
  unit: string;
  unit_id: number;
  status: string;
  last_move_out: string | null;
  market_rent: string | null;
  sqft: number | null;
  bd_ba: string | null;
  rent_ready: string | null;
  has_active_turn: boolean;
  active_turn_stage: number | null;
  default_assignee: string;
};

function formatRent(rent: string | null): string {
  if (!rent) return "—";
  const n = parseFloat(rent);
  return isNaN(n) ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// ── Settings row ──────────────────────────────────────────────────────────────

function SettingRow({ setting }: { setting: AppfolioSyncSetting }) {
  const [enabled, setEnabled] = useState(setting.sync_enabled);
  const [assignee, setAssignee] = useState(setting.default_assignee);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  function save() {
    setSaved(false);
    startTransition(async () => {
      await upsertSyncSettingAction(setting.property_id, enabled, assignee);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <tr>
      <td style={{ padding: "8px 12px", fontFamily: "var(--font-sans)", fontSize: 13, color: "#1A2E44" }}>
        {setting.property_name}
      </td>
      <td style={{ padding: "8px 12px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#1A2E44" }}
          />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: enabled ? "#1A2E44" : "#888" }}>
            {enabled ? "Enabled" : "Off"}
          </span>
        </label>
      </td>
      <td style={{ padding: "8px 12px" }}>
        <input
          type="text"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value.toUpperCase().slice(0, 5))}
          placeholder="??"
          disabled={!enabled}
          style={{
            fontFamily: "var(--font-sans)", fontSize: 12, padding: "4px 8px",
            border: "1px solid #ddd", borderRadius: 4, width: 60, textAlign: "center",
            background: enabled ? "#fff" : "#f5f5f5", color: enabled ? "#1A2E44" : "#999",
          }}
        />
      </td>
      <td style={{ padding: "8px 12px" }}>
        <button
          onClick={save}
          style={{
            fontFamily: "var(--font-sans)", fontSize: 11.5, padding: "4px 10px",
            background: saved ? "#22c55e" : "#1A2E44", color: "#F5F1E8",
            border: "none", borderRadius: 4, cursor: "pointer",
          }}
        >
          {saved ? "Saved ✓" : "Save"}
        </button>
      </td>
    </tr>
  );
}

// ── Create-turn inline form ───────────────────────────────────────────────────

function CreateTurnRow({
  unit,
  onCreated,
  onCancel,
}: {
  unit: VacantUnit;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const vacateDefault = unit.last_move_out ?? todayStr();
  const [assignee, setAssignee] = useState(unit.default_assignee);
  const [vacateDate, setVacateDate] = useState(vacateDefault);
  const [targetDate, setTargetDate] = useState(addDays(vacateDefault, 14));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await createTurnFromAppfolioAction({
          propertyId: unit.sb_property_id,
          unit: unit.unit,
          appfolioUnitId: unit.unit_id,
          vacateDate,
          targetDate,
          assignee,
        });
        onCreated();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create turn");
      }
    });
  }

  return (
    <tr style={{ background: "#f0f4f8" }}>
      <td colSpan={10} style={{ padding: "10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, color: "#1A2E44" }}>
            Create turn for {unit.property_name} · {unit.unit}
          </span>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: "#555" }}>Assignee</span>
            <input
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value.toUpperCase().slice(0, 5))}
              style={{ fontFamily: "var(--font-sans)", fontSize: 12, padding: "3px 6px", border: "1px solid #ccc", borderRadius: 4, width: 52, textAlign: "center" }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: "#555" }}>Vacated</span>
            <input
              type="date"
              value={vacateDate}
              onChange={(e) => {
                setVacateDate(e.target.value);
                setTargetDate(addDays(e.target.value, 14));
              }}
              style={{ fontFamily: "var(--font-sans)", fontSize: 12, padding: "3px 6px", border: "1px solid #ccc", borderRadius: 4 }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: "#555" }}>Target</span>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              style={{ fontFamily: "var(--font-sans)", fontSize: 12, padding: "3px 6px", border: "1px solid #ccc", borderRadius: 4 }}
            />
          </label>
          <button
            onClick={submit}
            disabled={pending || !assignee}
            style={{
              fontFamily: "var(--font-sans)", fontSize: 12, padding: "5px 14px",
              background: "#1A2E44", color: "#F5F1E8", border: "none", borderRadius: 4, cursor: "pointer",
              opacity: pending || !assignee ? 0.6 : 1,
            }}
          >
            {pending ? "Creating…" : "Confirm"}
          </button>
          <button
            onClick={onCancel}
            style={{ fontFamily: "var(--font-sans)", fontSize: 12, padding: "5px 10px", background: "transparent", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer", color: "#555" }}
          >
            Cancel
          </button>
          {error && <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "#dc2626" }}>{error}</span>}
        </div>
      </td>
    </tr>
  );
}

// ── Vacant units table ────────────────────────────────────────────────────────

function VacantUnitsSection({ syncedPropertyIds }: { syncedPropertyIds: number[] }) {
  const [units, setUnits] = useState<VacantUnit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingFor, setCreatingFor] = useState<number | null>(null); // unit_id

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/appfolio/vacant-units");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data: VacantUnit[] = await res.json();
      setUnits(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load vacant units");
    } finally {
      setLoading(false);
    }
  }

  const statusColor = (status: string) => {
    if (status.startsWith("Vacant")) return "#dc2626";
    return "#d97706";
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "#1A2E44", margin: 0 }}>
          Vacant Units
        </h2>
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            fontFamily: "var(--font-sans)", fontSize: 12, padding: "5px 14px",
            background: "#1A2E44", color: "#F5F1E8", border: "none", borderRadius: 4, cursor: "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Loading…" : units === null ? "Load Vacant Units" : "Refresh"}
        </button>
        {syncedPropertyIds.length === 0 && (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "#888" }}>
            Enable at least one building above to see vacancies here.
          </span>
        )}
      </div>

      {error && (
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#dc2626" }}>{error}</p>
      )}

      {units !== null && (
        <>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "#666", marginBottom: 10 }}>
            {units.length} unit{units.length !== 1 ? "s" : ""} across enabled buildings
            {units.filter((u) => !u.has_active_turn).length > 0
              ? ` · ${units.filter((u) => !u.has_active_turn).length} without a turn`
              : " · all have active turns"}
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#f0f4f8" }}>
                  {["Building", "Unit", "Status", "Move Out", "Market Rent", "Bd/Ba", "Sq Ft", "Rent Ready", "Turn"].map((h) => (
                    <th key={h} style={{ padding: "7px 12px", textAlign: "left", fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #ddd", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                  <th style={{ padding: "7px 12px", borderBottom: "1px solid #ddd" }} />
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <>
                    <tr
                      key={unit.unit_id}
                      style={{ borderBottom: "1px solid #f0f0f0", background: creatingFor === unit.unit_id ? "#f0f4f8" : "white" }}
                    >
                      <td style={{ padding: "7px 12px", fontFamily: "var(--font-sans)", color: "#1A2E44", whiteSpace: "nowrap" }}>{unit.property_name}</td>
                      <td style={{ padding: "7px 12px", fontFamily: "var(--font-mono, monospace)", fontSize: 12, color: "#1A2E44" }}>{unit.unit}</td>
                      <td style={{ padding: "7px 12px" }}>
                        <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, color: statusColor(unit.status), background: `${statusColor(unit.status)}15`, padding: "2px 7px", borderRadius: 10, whiteSpace: "nowrap" }}>
                          {unit.status}
                        </span>
                      </td>
                      <td style={{ padding: "7px 12px", fontFamily: "var(--font-sans)", color: "#444", whiteSpace: "nowrap" }}>{unit.last_move_out ?? "—"}</td>
                      <td style={{ padding: "7px 12px", fontFamily: "var(--font-sans)", color: "#444" }}>{formatRent(unit.market_rent)}</td>
                      <td style={{ padding: "7px 12px", fontFamily: "var(--font-sans)", color: "#444" }}>{unit.bd_ba ?? "—"}</td>
                      <td style={{ padding: "7px 12px", fontFamily: "var(--font-sans)", color: "#444" }}>{unit.sqft ?? "—"}</td>
                      <td style={{ padding: "7px 12px" }}>
                        {unit.rent_ready === "Yes" && (
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "#16a34a", fontWeight: 600 }}>Yes</span>
                        )}
                        {unit.rent_ready !== "Yes" && (
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "#888" }}>{unit.rent_ready ?? "—"}</span>
                        )}
                      </td>
                      <td style={{ padding: "7px 12px" }}>
                        {unit.has_active_turn ? (
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "#16a34a" }}>
                            Active · Stage {unit.active_turn_stage ?? "?"}
                          </span>
                        ) : (
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "#888" }}>No turn</span>
                        )}
                      </td>
                      <td style={{ padding: "7px 12px" }}>
                        {!unit.has_active_turn && creatingFor !== unit.unit_id && (
                          <button
                            onClick={() => setCreatingFor(unit.unit_id)}
                            style={{
                              fontFamily: "var(--font-sans)", fontSize: 11.5, padding: "4px 10px",
                              background: "#1A2E44", color: "#F5F1E8", border: "none", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap",
                            }}
                          >
                            + Create Turn
                          </button>
                        )}
                      </td>
                    </tr>
                    {creatingFor === unit.unit_id && (
                      <CreateTurnRow
                        key={`create-${unit.unit_id}`}
                        unit={unit}
                        onCreated={() => {
                          setCreatingFor(null);
                          // Mark as having an active turn in local state
                          setUnits((prev) =>
                            prev?.map((u) =>
                              u.unit_id === unit.unit_id
                                ? { ...u, has_active_turn: true, active_turn_stage: 0 }
                                : u,
                            ) ?? null,
                          );
                        }}
                        onCancel={() => setCreatingFor(null)}
                      />
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AppfolioSettings({ settings }: { settings: AppfolioSyncSetting[] }) {
  const enabledIds = settings.filter((s) => s.sync_enabled).map((s) => s.property_id);

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--color-cream)" }}>
      {/* Header */}
      <div style={{ background: "#1A2E44", padding: "50px 20px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <Link
              href="/admin"
              style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "rgba(245,241,232,0.6)", textDecoration: "none" }}
            >
              ← Admin
            </Link>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "#F5F1E8", letterSpacing: "-0.01em", marginTop: 6 }}>
              Admin · AppFolio Sync
            </h1>
          </div>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "rgba(245,241,232,0.5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Admin
          </span>
        </div>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "rgba(245,241,232,0.55)", marginTop: 10, maxWidth: 520, lineHeight: 1.5 }}>
          Enable buildings to pull vacant units from AppFolio. The nightly sync auto-creates
          turns for newly vacant units. Use the Vacant Units table to create turns manually.
        </p>
      </div>

      <div style={{ padding: "20px 16px 48px", maxWidth: 960, margin: "0 auto" }}>
        {/* Buildings section */}
        <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 28, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #f0f0f0" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "#1A2E44", margin: 0 }}>
              Buildings
            </h2>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "#666", marginTop: 4 }}>
              Set a default assignee (team initials) for auto-created turns.
            </p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Building", "Sync", "Default Assignee", ""].map((h) => (
                    <th key={h} style={{ padding: "7px 12px", textAlign: "left", fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #eee" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {settings.map((s) => (
                  <SettingRow key={s.property_id} setting={s} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vacant units section */}
        <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #f0f0f0" }}>
            <VacantUnitsSection syncedPropertyIds={enabledIds} />
          </div>
        </div>
      </div>
    </div>
  );
}
