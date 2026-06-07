"use client";

import { useState } from "react";
import { STAGES } from "@/lib/stages";

export function RevertSheet({
  propertyName,
  unit,
  currentStageIdx,
  onConfirm,
  onClose,
}: {
  propertyName: string;
  unit: string;
  currentStageIdx: number;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const atFirst = currentStageIdx === 0;
  const canConfirm = !atFirst && reason.trim().length > 0;

  const currentStageName = STAGES[currentStageIdx]?.name ?? "Current stage";
  const prevStageName = currentStageIdx > 0 ? STAGES[currentStageIdx - 1].name : null;

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
        {/* Header */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: "#1A2E44" }}>Send Back a Stage</div>
          <div style={{ fontWeight: 400, fontSize: 13, color: "rgba(11,27,43,0.55)", marginTop: 3 }}>
            {propertyName} · Unit {unit}
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(11,27,43,0.08)", margin: "14px 0" }} />

        {/* Stage flow indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 18,
            padding: "12px 14px",
            background: atFirst ? "rgba(11,27,43,0.04)" : "rgba(200,146,42,0.08)",
            border: `1.5px solid ${atFirst ? "rgba(11,27,43,0.08)" : "rgba(200,146,42,0.25)"}`,
            borderRadius: 10,
          }}
        >
          {atFirst ? (
            <span style={{ fontWeight: 500, fontSize: 13.5, color: "rgba(11,27,43,0.45)" }}>
              Already at first stage — cannot go back further.
            </span>
          ) : (
            <>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 13.5,
                  color: "#1A2E44",
                  background: "rgba(11,27,43,0.07)",
                  padding: "4px 10px",
                  borderRadius: 6,
                }}
              >
                {currentStageName}
              </span>
              <span style={{ fontSize: 15, color: "rgba(200,146,42,0.7)" }}>→</span>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 13.5,
                  color: "#C8922A",
                  background: "rgba(200,146,42,0.12)",
                  padding: "4px 10px",
                  borderRadius: 6,
                }}
              >
                {prevStageName}
              </span>
            </>
          )}
        </div>

        {/* Reason field */}
        {!atFirst && (
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
              Why is this being sent back? <span style={{ color: "#C8922A" }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Materials not ready — painting cannot begin yet"
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
        )}

        {/* Confirm */}
        <button
          type="button"
          onClick={() => canConfirm && onConfirm(reason)}
          disabled={!canConfirm}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 8,
            border: "none",
            background: canConfirm ? "#C8922A" : "rgba(11,27,43,0.1)",
            color: canConfirm ? "#fff" : "rgba(11,27,43,0.3)",
            fontWeight: 600,
            fontSize: 15,
            cursor: canConfirm ? "pointer" : "not-allowed",
            transition: "background 0.15s",
          }}
        >
          {prevStageName ? `Send back to ${prevStageName} →` : "Cannot revert"}
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
