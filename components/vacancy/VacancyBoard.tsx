"use client";

import { useState } from "react";
import { formatDay, type BuildingGroup, type RegionGroup, type UpcomingUnit, type VacancyBoard as Board, type VacantUnit } from "@/lib/vacancy-board";

type Tab = "vacant" | "upcoming";

const INK = "#0B1B2B";
const CREAM = "#F5F1E8";
const NAVY = "#1A2E44";
const MOSS = "#3D7A5F";
const AMBER = "#C8922A";
const BRICK = "#8B4A2F";
const STEEL = "#4A7FA5";

/** Green under two weeks, amber under a month, brick beyond — the same
 *  read-at-a-glance scale the turns board uses for urgency. */
function daysColor(days: number | null): string {
  if (days === null) return "#697E94";
  if (days >= 30) return BRICK;
  if (days >= 15) return AMBER;
  return MOSS;
}

function DayBadge({ value, caption, color }: { value: string; caption: string; color: string }) {
  return (
    <div
      style={{
        flexShrink: 0,
        minWidth: 58,
        background: color,
        borderRadius: 10,
        padding: "7px 8px 6px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 22,
          lineHeight: 1,
          color: "#fff",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.8)",
        }}
      >
        {caption}
      </span>
    </div>
  );
}

function UnitRow({
  unit,
  size,
  detail,
  note,
  badge,
}: {
  unit: string;
  size: string | null;
  detail: string;
  note: string | null;
  badge: React.ReactNode;
}) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 16px",
        borderBottom: "1px solid rgba(11,27,43,0.07)",
        background: CREAM,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>
            {unit}
          </span>
          {size && (
            <span style={{ fontSize: 12.5, fontWeight: 500, color: "rgba(11,27,43,0.5)" }}>{size}</span>
          )}
        </div>
        <div style={{ fontSize: 13, color: "rgba(11,27,43,0.62)", marginTop: 2 }}>{detail}</div>
        {note && (
          <div style={{ fontSize: 12, fontWeight: 600, color: STEEL, marginTop: 3 }}>{note}</div>
        )}
      </div>
      {badge}
    </li>
  );
}

function BuildingSection({ building, children }: { building: string; children: React.ReactNode }) {
  return (
    <section>
      <h3
        style={{
          margin: 0,
          padding: "7px 16px",
          background: "#E8E4DC",
          fontFamily: "var(--font-sans)",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "rgba(11,27,43,0.62)",
          borderTop: "1px solid rgba(11,27,43,0.08)",
          borderBottom: "1px solid rgba(11,27,43,0.08)",
        }}
      >
        {building}
      </h3>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{children}</ul>
    </section>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}
    >
      <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** One service area: a tap target that opens to reveal its buildings. */
function RegionSection({
  region,
  unitCount,
  agedCount,
  open,
  onToggle,
  children,
}: {
  region: string;
  unitCount: number;
  agedCount: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const empty = unitCount === 0;
  const panelId = `region-${region.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <section>
      <h2 style={{ margin: 0 }}>
        <button
          type="button"
          onClick={empty ? undefined : onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          disabled={empty}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            border: "none",
            borderBottom: "1px solid rgba(11,27,43,0.1)",
            background: NAVY,
            color: empty ? "rgba(245,241,232,0.45)" : CREAM,
            cursor: empty ? "default" : "pointer",
            textAlign: "left",
            font: "inherit",
          }}
        >
          <Chevron open={open} />
          <span
            style={{
              flex: 1,
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {region}
          </span>
          {agedCount > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 999,
                padding: "2px 8px",
                background: BRICK,
                color: "#fff",
                whiteSpace: "nowrap",
              }}
            >
              {agedCount} over 30d
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(245,241,232,0.7)", whiteSpace: "nowrap" }}>
            {empty ? "None" : `${unitCount} ${unitCount === 1 ? "unit" : "units"}`}
          </span>
        </button>
      </h2>
      <div id={panelId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p style={{ padding: "48px 24px", textAlign: "center", fontSize: 15, color: "rgba(11,27,43,0.45)" }}>
      {message}
    </p>
  );
}

function vacantBuilding(group: BuildingGroup<VacantUnit>) {
  return (
    <BuildingSection key={group.building} building={group.building}>
      {group.units.map((u) => (
        <UnitRow
          key={u.key}
          unit={u.unit}
          size={u.size}
          detail={u.vacatedOn ? `Empty since ${formatDay(u.vacatedOn)}` : "Move-out date unknown"}
          note={u.moveIn ? `Rented — move-in ${formatDay(u.moveIn)}` : null}
          badge={
            <DayBadge
              value={u.daysVacant === null ? "—" : String(u.daysVacant)}
              caption={u.daysVacant === 1 ? "day" : "days"}
              color={daysColor(u.daysVacant)}
            />
          }
        />
      ))}
    </BuildingSection>
  );
}

function upcomingBuilding(group: BuildingGroup<UpcomingUnit>) {
  return (
    <BuildingSection key={group.building} building={group.building}>
      {group.units.map((u) => {
        const days = u.daysUntilOut;
        const badgeValue = days === null ? "—" : days <= 0 ? "0" : String(days);
        return (
          <UnitRow
            key={u.key}
            unit={u.unit}
            size={u.size}
            detail={u.movesOut ? `Moves out ${formatDay(u.movesOut)}` : "Move-out date not set"}
            note={u.availableOn ? `Ready to rent ${formatDay(u.availableOn)}` : null}
            badge={
              <DayBadge
                value={badgeValue}
                caption={days !== null && days <= 0 ? "now" : badgeValue === "1" ? "day" : "days"}
                color={STEEL}
              />
            }
          />
        );
      })}
    </BuildingSection>
  );
}

function RegionList<T>({
  areas,
  emptyMessage,
  openRegions,
  onToggle,
  renderBuilding,
  showAged,
}: {
  areas: RegionGroup<T>[];
  emptyMessage: string;
  openRegions: Set<string>;
  onToggle: (region: string) => void;
  renderBuilding: (group: BuildingGroup<T>) => React.ReactNode;
  showAged: boolean;
}) {
  const total = areas.reduce((n, a) => n + a.unitCount, 0);
  if (total === 0) return <EmptyState message={emptyMessage} />;
  return (
    <>
      {areas.map((area) => (
        <RegionSection
          key={area.region}
          region={area.region}
          unitCount={area.unitCount}
          agedCount={showAged ? area.longVacantCount : 0}
          open={openRegions.has(area.region)}
          onToggle={() => onToggle(area.region)}
        >
          {area.buildings.map(renderBuilding)}
        </RegionSection>
      ))}
    </>
  );
}

export function VacancyBoard({ board, asOf }: { board: Board; asOf: string | null }) {
  const [tab, setTab] = useState<Tab>("vacant");
  // Areas start closed so the first screen is four lines, not sixty. Tracked
  // per tab: opening Seattle on Vacant Now should not also open it on Coming
  // Up, which is a different list of work.
  const [openVacant, setOpenVacant] = useState<Set<string>>(new Set());
  const [openUpcoming, setOpenUpcoming] = useState<Set<string>>(new Set());

  const openRegions = tab === "vacant" ? openVacant : openUpcoming;
  const setOpenRegions = tab === "vacant" ? setOpenVacant : setOpenUpcoming;

  function toggleRegion(region: string) {
    setOpenRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "vacant", label: "Vacant Now", count: board.vacantCount },
    { key: "upcoming", label: "Coming Up", count: board.upcomingCount },
  ];

  const areaCount = (tab === "vacant" ? board.vacant : board.upcoming).filter(
    (a) => a.unitCount > 0,
  ).length;
  const summary =
    tab === "vacant"
      ? `${board.vacantCount} ${board.vacantCount === 1 ? "unit" : "units"} in ${areaCount} ${areaCount === 1 ? "area" : "areas"}${board.longVacantCount > 0 ? ` · ${board.longVacantCount} over 30 days` : ""}`
      : `${board.upcomingCount} ${board.upcomingCount === 1 ? "unit" : "units"} on notice in ${areaCount} ${areaCount === 1 ? "area" : "areas"}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: CREAM }}>
      <header style={{ flexShrink: 0, background: NAVY, padding: "16px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 23,
              color: CREAM,
              letterSpacing: "-0.01em",
            }}
          >
            Vacancies
          </h1>
          <span style={{ fontSize: 11.5, color: "rgba(245,241,232,0.55)", whiteSpace: "nowrap" }}>
            {asOf ? `Updated ${formatDay(asOf)}` : "No data yet"}
          </span>
        </div>

        <div role="tablist" aria-label="Vacancy views" style={{ display: "flex", gap: 8, margin: "14px 0 0" }}>
          {tabs.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                style={{
                  flex: 1,
                  border: "none",
                  borderRadius: "10px 10px 0 0",
                  padding: "11px 8px 12px",
                  background: active ? CREAM : "rgba(245,241,232,0.1)",
                  color: active ? INK : "rgba(245,241,232,0.7)",
                  fontSize: 14.5,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                }}
              >
                {t.label}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: "1px 7px",
                    background: active ? NAVY : "rgba(245,241,232,0.18)",
                    color: active ? CREAM : "rgba(245,241,232,0.85)",
                  }}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <p
        style={{
          flexShrink: 0,
          margin: 0,
          padding: "9px 16px",
          background: CREAM,
          fontSize: 12.5,
          fontWeight: 500,
          color: "rgba(11,27,43,0.55)",
          borderBottom: "1px solid rgba(11,27,43,0.08)",
        }}
      >
        {summary}
      </p>

      <main
        role="tabpanel"
        style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 28 }}
      >
        {tab === "vacant" ? (
          <RegionList
            areas={board.vacant}
            emptyMessage="Nothing is vacant right now."
            openRegions={openRegions}
            onToggle={toggleRegion}
            renderBuilding={vacantBuilding}
            showAged
          />
        ) : (
          <RegionList
            areas={board.upcoming}
            emptyMessage="No upcoming move-outs."
            openRegions={openRegions}
            onToggle={toggleRegion}
            renderBuilding={upcomingBuilding}
            showAged={false}
          />
        )}
      </main>
    </div>
  );
}
