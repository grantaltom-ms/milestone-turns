"use client";

import { useState } from "react";
import type { HoldStatus } from "@/lib/supabase/types";

export function HoldSheet({
  propertyName,
  unit,
  currentStatus,
  currentReason,
  onConfirm,
  onClose,
}: {
  propertyName: string;
  unit: string;
  currentStatus?: HoldStatus | null;
  currentReason?: string | null;
  onConfirm: (status: HoldStatus, reason: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<HoldStatus>(currentStatus ?? "on_hold");
  const [reason, setReason] = useState(currentReason ?? "");
  const canConfirm = reason.trim().length > 0;

  const OPTIONS: { value: HoldStatus; label: string; icon: string; color: string; desc: string }[] = [
    {
      value: "on_hold",
      label: "On Hold",
      icon: "⏸",
      color: "#C8922A",
      desc: "Waiting on something — vendor, part, approval, etc.",
    },
    {
      value: "blocked",
      label: "Blocked",
      icon: "🚫",
      color: "#8B4A2F",
      desc: "Cannot proceed — access issue, dispute, safety concern, etc.",
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(11,27,43,0.5)",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#F5F1E8",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: "20px 16px 32px",
          boxShadow: "0 -8px 24px rgba(11,27,43,0.2)",
        }}
      >
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: "#1A2E44" }}>Put Turn on Hold</div>
          <div style={{ fontWeight: 400, fontSize: 13, color: "rgba(11,27,43,0.55)", marginTop: 3 }}>
            {propertyName} · Unit {unit}
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(11,27,43,0.08)", margin: "14px 0" }} />

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {OPTIONS.map((opt) => {
            const active = selected === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelected(opt.value)}
                style={{
                  flex: 1,
                  padding: "12px 10px",
                  borderRadius: 10,
                  border: `2px solid ${active ? opt.color : "rgba(11,27,43,0.1)"}`,
                  background: active ? `${opt.color}14` : "#fff",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 4 }}>{opt.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: active ? opt.color : "#1A2E44" }}>
                  {opt.label}
                </div>
                <div style={{ fontWeight: 400, fontSize: 11.5, color: "rgba(11,27,43,0.5)", marginTop: 3, lineHeight: 1.3 }}>
                  {opt.desc}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              fontWeight: 600,
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "rgba(11,27,43,0.45)",
              marginBottom: 7,
            }}
          >
            Reason <span style={{ color: "#C8922A" }}>*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              selected === "blocked"
                ? "e.g. Tenant dispute — access denied until resolved"
                : "e.g. Waiting on HVAC vendor — ETA unknown"
            }
            rows={3}
            autoFocus
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1.5px solid ${reason.trim() ? "rgba(11,27,43,0.2)" : "rgba(11,27,43,0.12)"}`,
              background: "#fff",
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              color: "#0B1B2B",
              outline: "none",
              resize: "none",
              boxSizing: "border-box",
              lineHeight: 1.5,
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => canConfirm && onConfirm(selected, reason)}
          disabled={!canConfirm}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 8,
            border: "none",
            background: canConfirm
              ? selected === "blocked" ? "#8B4A2F" : "#C8922A"
              : "rgba(11,27,43,0.1)",
            color: canConfirm ? "#fff" : "rgba(11,27,43,0.3)",
            fontWeight: 600,
            fontSize: 15,
            cursor: canConfirm ? "pointer" : "not-allowed",
            transition: "background 0.15s",
          }}
        >
          {selected === "blocked" ? "🚫 Mark as Blocked" : "⏸ Put on Hold"}
        </button>

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 8,
            width: "100%",
            padding: 12,
            background: "transparent",
            border: "1px solid rgba(11,27,43,0.15)",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 500,
            fontSize: 14,
            color: "rgba(11,27,43,0.6)",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
