"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createTurnAction } from "@/app/actions";
import { normalizeUnit } from "@/lib/csv-import";
import { avatarColor, DEFAULT_TASKS, TEAM } from "@/lib/stages";
import type { PropertyRow } from "@/lib/supabase/types";

type Errors = Partial<Record<"property" | "unit" | "vacate" | "target", true>>;

const LABEL_STYLE = (error?: boolean): React.CSSProperties => ({
  display: "block",
  fontWeight: 500,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: error ? "#8B4A2F" : "rgba(11,27,43,0.52)",
  marginBottom: 7,
});

const INPUT_STYLE = (error?: boolean): React.CSSProperties => ({
  width: "100%",
  border: `1.5px solid ${error ? "#C45C3B" : "rgba(11,27,43,0.14)"}`,
  borderRadius: 8,
  padding: "12px 13px",
  fontWeight: 400,
  fontSize: 14.5,
  color: "#0B1B2B",
  background: "#fff",
  outline: "none",
  WebkitAppearance: "none",
  appearance: "none",
});

export function NewTurnForm({ properties, defaultAssignee }: { properties: PropertyRow[]; defaultAssignee: string }) {
  const [propertyId, setPropertyId] = useState<string>("");
  const [unit, setUnit] = useState("");
  const [vacateDate, setVacateDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [assignee, setAssignee] = useState(
    TEAM.includes(defaultAssignee as (typeof TEAM)[number]) ? defaultAssignee : TEAM[0],
  );
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const e: Errors = {};
    if (!propertyId) e.property = true;
    if (!unit.trim()) e.unit = true;
    if (!vacateDate) e.vacate = true;
    if (!targetDate) e.target = true;
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setErrors({});
    setSubmitError(null);
    const normalizedUnit = normalizeUnit(unit);
    startTransition(async () => {
      try {
        await createTurnAction({
          property_id: Number(propertyId),
          unit: normalizedUnit,
          vacate_date: vacateDate,
          target_date: targetDate,
          assignee,
        });
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Could not create turn");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ background: "#1A2E44", padding: "50px 20px 18px", flexShrink: 0 }}>
        <Link
          href="/"
          style={{
            background: "transparent",
            color: "rgba(245,241,232,0.72)",
            fontWeight: 500,
            fontSize: 13.5,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            paddingBottom: 10,
          }}
        >
          ← Cancel
        </Link>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 20,
            color: "#F5F1E8",
          }}
        >
          New Unit Turn
        </h1>
        <p
          style={{
            fontWeight: 300,
            fontSize: 13,
            color: "rgba(245,241,232,0.58)",
            marginTop: 4,
          }}
        >
          Starts at <strong style={{ color: "#5BAE97", fontWeight: 600 }}>Notice</strong> with a standard checklist.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 120px", background: "#F5F1E8" }}>
        <div style={{ marginBottom: 16 }}>
          <label style={LABEL_STYLE(errors.property)}>Property</label>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            style={INPUT_STYLE(errors.property)}
          >
            <option value="">Select a property…</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={LABEL_STYLE(errors.unit)}>Unit number</label>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g. 204"
            style={INPUT_STYLE(errors.unit)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={LABEL_STYLE(errors.vacate)}>Vacate date</label>
            <input
              type="date"
              value={vacateDate}
              onChange={(e) => setVacateDate(e.target.value)}
              style={INPUT_STYLE(errors.vacate)}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={LABEL_STYLE(errors.target)}>Target ready</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              style={INPUT_STYLE(errors.target)}
            />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={LABEL_STYLE()}>Assign owner</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TEAM.map((initials) => {
              const selected = assignee === initials;
              const color = avatarColor(initials);
              return (
                <button
                  key={initials}
                  type="button"
                  onClick={() => setAssignee(initials)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    border: `2.5px solid ${selected ? color : "transparent"}`,
                    background: selected ? color : "rgba(11,27,43,0.08)",
                    color: selected ? "#fff" : "#0B1B2B",
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: "pointer",
                  }}
                >
                  {initials}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            background: "rgba(46,107,94,0.09)",
            border: "1px solid rgba(46,107,94,0.22)",
            borderRadius: 8,
            padding: "12px 14px",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: 11.5,
              color: "#2E6B5E",
              marginBottom: 7,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Auto-filled checklist
          </div>
          {DEFAULT_TASKS[0].map((name) => (
            <div
              key={name}
              style={{
                fontWeight: 400,
                fontSize: 13,
                color: "rgba(11,27,43,0.62)",
                padding: "3px 0",
                display: "flex",
                gap: 8,
              }}
            >
              <span style={{ color: "#2E6B5E" }}>○</span>
              {name}
            </div>
          ))}
        </div>

        {submitError && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 12px",
              background: "rgba(196,92,59,0.1)",
              border: "1px solid rgba(196,92,59,0.3)",
              borderRadius: 8,
              fontSize: 13,
              color: "#8B4A2F",
            }}
          >
            {submitError}
          </div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "12px 16px 28px",
          background: "#F5F1E8",
          borderTop: "1px solid rgba(11,27,43,0.08)",
        }}
      >
        <button
          type="button"
          onClick={save}
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
          {pending ? "Creating…" : "Create turn"}
        </button>
      </div>
    </div>
  );
}
