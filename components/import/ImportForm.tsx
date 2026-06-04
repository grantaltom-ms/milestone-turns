"use client";

import Papa from "papaparse";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { bulkCreateTurnsAction } from "@/app/actions";
import {
  IGNORED_COLUMNS,
  type ParsedRow,
  type RawRow,
  REQUIRED_COLUMNS,
  validateRow,
} from "@/lib/csv-import";
import { avatarColor, TEAM } from "@/lib/stages";

export function ImportForm({
  propertyByName,
  propertyNameById,
  defaultAssignee,
}: {
  propertyByName: Record<string, number>;
  propertyNameById: Record<string, string>;
  defaultAssignee: string;
}) {
  const router = useRouter();
  const byName = useMemo(() => new Map(Object.entries(propertyByName)), [propertyByName]);
  const nameById = useMemo(
    () => new Map(Object.entries(propertyNameById).map(([k, v]) => [Number(k), v])),
    [propertyNameById],
  );

  const initialAssignee = TEAM.includes(defaultAssignee as (typeof TEAM)[number])
    ? defaultAssignee
    : TEAM[0];

  const [assignee, setAssignee] = useState<string>(initialAssignee);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<RawRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; failed: { rowNumber: number; message: string }[] } | null>(null);
  const [pending, startTransition] = useTransition();

  // Re-validate whenever the assignee or parsed rows change.
  const rows: ParsedRow[] | null = useMemo(() => {
    if (!rawRows) return null;
    return rawRows.map((row, i) => validateRow(row, i + 1, byName, nameById, assignee));
  }, [rawRows, assignee, byName, nameById]);

  const visibleRows = useMemo(() => rows?.filter((r) => !r.skip) ?? [], [rows]);
  const validRows = useMemo(() => visibleRows.filter((r) => r.errors.length === 0), [visibleRows]);
  const errorCount = visibleRows.length - validRows.length;

  function handleFile(file: File) {
    setFileName(file.name);
    setParseError(null);
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const headers = res.meta.fields ?? [];
        const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
        if (missing.length) {
          setParseError(
            `Missing column(s): ${missing.join(", ")}. Expected an AppFolio Unit Vacancy Detail export.`,
          );
          setRawRows(null);
          return;
        }
        const parsed: RawRow[] = res.data.map((row) => ({
          property: (row["property name"] ?? "").trim(),
          unit: (row["unit"] ?? "").trim(),
          vacate_date: (row["last move out"] ?? "").trim(),
          target_date: (row["available on"] ?? "").trim(),
          unit_status: (row["unit status"] ?? "").trim() || undefined,
        }));
        setRawRows(parsed);
      },
      error: (err) => setParseError(err.message),
    });
  }

  function commit() {
    if (!validRows.length) return;
    startTransition(async () => {
      const payload = validRows.map((r) => ({
        property_id: r.property_id!,
        unit: r.unit_normalized,
        vacate_date: r.vacate_iso,
        target_date: r.target_iso,
        assignee,
      }));
      const res = await bulkCreateTurnsAction(payload);
      setResult(res);
      if (res.failed.length === 0) {
        router.push("/");
        router.refresh();
      }
    });
  }

  function downloadTemplate() {
    const csv =
      `Unit,Bed/Bath,Sqft,Unit Status,Rent Ready,Days Vacant,Last Move Out,Available On,Next Move In,Property Name\n` +
      `204,2/1.00,860,Vacant-Unrented,Yes,30,02/28/2026,03/15/2026,,Stonehaven Apartments\n` +
      `A 101,1/1.00,662,Vacant-Unrented,Yes,12,03/12/2026,03/22/2026,,Willow Lake Apartments\n`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "unit-turns-template.csv";
    a.click();
    URL.revokeObjectURL(url);
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
          Import turns from CSV
        </h1>
        <p
          style={{
            fontWeight: 300,
            fontSize: 13,
            color: "rgba(245,241,232,0.58)",
            marginTop: 4,
          }}
        >
          Accepts an AppFolio <em>Unit Vacancy Detail</em> export. Each row creates a turn at{" "}
          <strong style={{ color: "#5BAE97", fontWeight: 600 }}>Notice</strong>.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 120px", background: "#F5F1E8" }}>
        <div style={{ marginBottom: 18 }}>
          <label
            style={{
              display: "block",
              fontWeight: 500,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "rgba(11,27,43,0.52)",
              marginBottom: 7,
            }}
          >
            Assign all to
          </label>
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
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    border: `2.5px solid ${selected ? color : "transparent"}`,
                    background: selected ? color : "rgba(11,27,43,0.08)",
                    color: selected ? "#fff" : "#0B1B2B",
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  {initials}
                </button>
              );
            })}
          </div>
        </div>

        {!rows && (
          <>
            <div
              style={{
                fontWeight: 600,
                fontSize: 10.5,
                textTransform: "uppercase",
                letterSpacing: "0.16em",
                color: "#2E6B5E",
                marginBottom: 11,
              }}
            >
              Step 1 — Upload file
            </div>
            <label
              style={{
                display: "block",
                background: "#fff",
                border: "1.5px dashed rgba(11,27,43,0.2)",
                borderRadius: 10,
                padding: "26px 16px",
                textAlign: "center",
                cursor: "pointer",
              }}
            >
              <input
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <div style={{ fontWeight: 600, fontSize: 14, color: "#0B1B2B" }}>
                {fileName ?? "Choose a CSV file"}
              </div>
              <div style={{ fontWeight: 400, fontSize: 12.5, color: "rgba(11,27,43,0.55)", marginTop: 4 }}>
                Required: Property Name · Unit · Last Move Out · Available On
              </div>
              <div style={{ fontWeight: 400, fontSize: 11.5, color: "rgba(11,27,43,0.4)", marginTop: 4 }}>
                Other columns ({IGNORED_COLUMNS.join(", ")}) are ignored.
              </div>
            </label>
            <button
              type="button"
              onClick={downloadTemplate}
              style={{
                marginTop: 12,
                background: "transparent",
                border: "none",
                color: "#2E6B5E",
                fontWeight: 500,
                fontSize: 13,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Download template
            </button>

            {parseError && (
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
                {parseError}
              </div>
            )}
          </>
        )}

        {rows && !result && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.16em",
                  color: "#2E6B5E",
                }}
              >
                Step 2 — Preview ({validRows.length} ok · {errorCount} error
                {errorCount !== 1 ? "s" : ""})
              </div>
              <button
                type="button"
                onClick={() => {
                  setRawRows(null);
                  setFileName(null);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(11,27,43,0.6)",
                  fontSize: 13,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Re-upload
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {visibleRows.map((r) => {
                const bad = r.errors.length > 0;
                return (
                  <div
                    key={r.rowNumber}
                    style={{
                      background: "#fff",
                      border: `1px solid ${bad ? "rgba(196,92,59,0.4)" : "rgba(11,27,43,0.07)"}`,
                      borderLeft: `4px solid ${bad ? "#C45C3B" : "#3D7A5F"}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 13.5, color: "#0B1B2B" }}>
                        {(r.property_name_resolved ?? r.raw.property) || "—"}{" "}
                        <span style={{ color: "#2E6B5E" }}>{r.unit_normalized || "—"}</span>
                      </span>
                      <span style={{ fontWeight: 500, fontSize: 12, color: "rgba(11,27,43,0.5)" }}>
                        row {r.rowNumber}
                      </span>
                    </div>
                    <div
                      style={{
                        fontWeight: 400,
                        fontSize: 12.5,
                        color: "rgba(11,27,43,0.55)",
                        marginTop: 3,
                      }}
                    >
                      {r.vacate_iso || r.raw.vacate_date || "—"} → {r.target_iso || r.raw.target_date || "—"}
                      {r.raw.unit_status ? ` · ${r.raw.unit_status}` : ""}
                    </div>
                    {bad && (
                      <div
                        style={{
                          fontWeight: 500,
                          fontSize: 12.5,
                          color: "#8B4A2F",
                          marginTop: 5,
                        }}
                      >
                        {r.errors.join(" · ")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {result && (
          <div
            style={{
              background: result.failed.length === 0 ? "rgba(61,122,95,0.12)" : "rgba(200,146,42,0.12)",
              border: `1px solid ${result.failed.length === 0 ? "rgba(61,122,95,0.3)" : "rgba(200,146,42,0.4)"}`,
              borderRadius: 8,
              padding: "12px 14px",
              fontWeight: 500,
              fontSize: 13.5,
              color: result.failed.length === 0 ? "#3D7A5F" : "#8B5D17",
            }}
          >
            Created {result.created} turn{result.created !== 1 ? "s" : ""}.
            {result.failed.length > 0 && (
              <div style={{ marginTop: 6, color: "#8B4A2F", fontSize: 12.5 }}>
                Failed: {result.failed.map((f) => `row ${f.rowNumber} (${f.message})`).join(", ")}
              </div>
            )}
          </div>
        )}
      </div>

      {rows && !result && (
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
            onClick={commit}
            disabled={pending || validRows.length === 0}
            style={{
              width: "100%",
              padding: 15,
              borderRadius: 8,
              border: "none",
              cursor: pending || validRows.length === 0 ? "not-allowed" : "pointer",
              background: validRows.length === 0 ? "#E8E4DC" : "#2E6B5E",
              color: validRows.length === 0 ? "rgba(11,27,43,0.28)" : "#fff",
              fontWeight: 600,
              fontSize: 15,
              opacity: pending ? 0.8 : 1,
            }}
          >
            {pending
              ? "Creating…"
              : validRows.length === 0
                ? "Fix errors to continue"
                : `Create ${validRows.length} turn${validRows.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
