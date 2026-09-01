import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildVacancyBoard,
  daysBetween,
  formatDay,
  formatSize,
  todayInSeattle,
  type VacancySnapshotRow,
} from "../lib/vacancy-board.ts";

const TODAY = "2026-09-01";

function row(over: Partial<VacancySnapshotRow>): VacancySnapshotRow {
  return {
    property_name: "Ascona",
    unit: "101",
    unit_status: "Vacant-Unrented",
    bed_bath: "1/1.00",
    sqft: 500,
    last_move_out: "2026-08-01",
    available_on: null,
    next_move_in: null,
    ...over,
  };
}

test("daysBetween counts whole days across a month boundary", () => {
  assert.equal(daysBetween("2026-08-01", "2026-09-01"), 31);
  assert.equal(daysBetween("2026-09-01", "2026-09-01"), 0);
  assert.equal(daysBetween("2026-09-15", "2026-09-01"), -14);
});

test("daysBetween is not thrown off by daylight saving", () => {
  // US DST ends 2026-11-01; a naive local-time diff would return 30.958… here.
  assert.equal(daysBetween("2026-10-15", "2026-11-15"), 31);
});

test("todayInSeattle stays on the previous day late Pacific evening", () => {
  // 06:30 UTC on Sep 2 is 23:30 Pacific on Sep 1.
  assert.equal(todayInSeattle(new Date("2026-09-02T06:30:00Z")), "2026-09-01");
  assert.equal(todayInSeattle(new Date("2026-09-01T18:00:00Z")), "2026-09-01");
});

test("formatSize renders studios and trims trailing zeros on baths", () => {
  assert.equal(formatSize("0/1.00"), "Studio · 1 ba");
  assert.equal(formatSize("2/1.50"), "2 bd · 1.5 ba");
  assert.equal(formatSize("1/1.00"), "1 bd · 1 ba");
  assert.equal(formatSize(null), null);
});

test("formatDay renders a short date and rejects junk", () => {
  assert.equal(formatDay("2026-09-15"), "Sep 15");
  assert.equal(formatDay("2026-01-02"), "Jan 2");
  assert.equal(formatDay(null), null);
  assert.equal(formatDay("not-a-date"), null);
});

test("splits vacant units from units on notice", () => {
  const board = buildVacancyBoard(
    [
      row({ unit: "101", unit_status: "Vacant-Unrented" }),
      row({ unit: "102", unit_status: "Vacant-Rented", next_move_in: "2026-09-10" }),
      row({ unit: "103", unit_status: "Notice-Unrented", last_move_out: "2026-09-20" }),
      row({ unit: "104", unit_status: "Notice-Rented", last_move_out: "2026-09-25" }),
      row({ unit: "105", unit_status: "Occupied" }),
    ],
    TODAY,
  );
  assert.equal(board.vacantCount, 2);
  assert.equal(board.upcomingCount, 2);
  assert.deepEqual(
    board.vacant.flatMap((g) => g.units.map((u) => u.unit)).sort(),
    ["101", "102"],
  );
  assert.equal(board.vacant[0].units.find((u) => u.unit === "102")?.moveIn, "2026-09-10");
});

test("counts days vacant and floors a future move-out at zero", () => {
  const board = buildVacancyBoard(
    [
      row({ unit: "101", last_move_out: "2026-08-01" }),
      row({ unit: "102", last_move_out: "2026-09-30" }),
      row({ unit: "103", last_move_out: null }),
    ],
    TODAY,
  );
  const units = Object.fromEntries(board.vacant[0].units.map((u) => [u.unit, u.daysVacant]));
  assert.equal(units["101"], 31);
  assert.equal(units["102"], 0);
  assert.equal(units["103"], null);
});

test("lists vacant buildings alphabetically, not by how bad they are", () => {
  const board = buildVacancyBoard(
    [
      row({ property_name: "Bel Vista", unit: "1", last_move_out: "2026-08-25" }),
      row({ property_name: "Ascona", unit: "2", last_move_out: "2026-06-01" }),
      row({ property_name: "Ascona", unit: "10", last_move_out: "2026-08-30" }),
      row({ property_name: "Crosby", unit: "3", last_move_out: "2026-08-28" }),
      // Longest-empty of the lot, but alphabetically last — it must not jump
      // to the top the way an urgency-ranked order would put it.
      row({ property_name: "Woodland", unit: "4", last_move_out: "2026-01-01" }),
    ],
    TODAY,
  );
  assert.deepEqual(
    board.vacant.map((g) => g.building),
    ["Ascona", "Bel Vista", "Crosby", "Woodland"],
  );
  // Within a building, longest-empty still leads.
  assert.deepEqual(board.vacant[0].units.map((u) => u.unit), ["2", "10"]);
});

test("sorts building names case-insensitively, and numeric-led ones by value", () => {
  const board = buildVacancyBoard(
    [
      row({ property_name: "ascona", unit: "1", last_move_out: "2026-08-01" }),
      row({ property_name: "9275 Renton", unit: "2", last_move_out: "2026-08-01" }),
      row({ property_name: "1255 Kearny St", unit: "3", last_move_out: "2026-08-01" }),
      row({ property_name: "Bel Vista", unit: "4", last_move_out: "2026-08-01" }),
    ],
    TODAY,
  );
  // "1255" before "9275" by value, not "1" before "9" then digit by digit —
  // and lowercase "ascona" still sorts with the A's, not after Z.
  assert.deepEqual(
    board.vacant.map((g) => g.building),
    ["1255 Kearny St", "9275 Renton", "ascona", "Bel Vista"],
  );
});

test("lists upcoming buildings alphabetically, soonest unit first within each", () => {
  const board = buildVacancyBoard(
    [
      row({ property_name: "Envoy", unit: "106", unit_status: "Notice-Unrented", last_move_out: "2026-09-30", available_on: "2026-10-10" }),
      row({ property_name: "DD Culp", unit: "220", unit_status: "Notice-Unrented", last_move_out: "2026-09-07", available_on: "2026-09-17" }),
      row({ property_name: "DD Culp", unit: "116", unit_status: "Notice-Unrented", last_move_out: "2026-09-30", available_on: "2026-10-10" }),
      // Soonest move-out overall, but alphabetically last.
      row({ property_name: "Woodland", unit: "5", unit_status: "Notice-Unrented", last_move_out: "2026-09-02", available_on: "2026-09-12" }),
    ],
    TODAY,
  );
  assert.deepEqual(board.upcoming.map((g) => g.building), ["DD Culp", "Envoy", "Woodland"]);
  assert.deepEqual(board.upcoming[0].units.map((u) => u.unit), ["220", "116"]);
  assert.equal(board.upcoming[0].units[0].daysUntilOut, 6);
});

test("sorts unit numbers naturally, not as text", () => {
  const board = buildVacancyBoard(
    [
      row({ unit: "10", last_move_out: "2026-08-01" }),
      row({ unit: "2", last_move_out: "2026-08-01" }),
      row({ unit: "1", last_move_out: "2026-08-01" }),
    ],
    TODAY,
  );
  assert.deepEqual(board.vacant[0].units.map((u) => u.unit), ["1", "2", "10"]);
});

test("counts units sitting 30+ days", () => {
  const board = buildVacancyBoard(
    [
      row({ unit: "1", last_move_out: "2026-08-02" }), // 30 days
      row({ unit: "2", last_move_out: "2026-08-03" }), // 29 days
      row({ unit: "3", last_move_out: "2026-01-01" }),
    ],
    TODAY,
  );
  assert.equal(board.longVacantCount, 2);
});

test("survives missing building and unit names without dropping rows", () => {
  const board = buildVacancyBoard(
    [row({ property_name: null, unit: null }), row({ property_name: "  ", unit: "  " })],
    TODAY,
  );
  assert.equal(board.vacantCount, 2);
  assert.equal(board.vacant[0].building, "Unknown building");
  assert.equal(board.vacant[0].units[0].unit, "—");
});

test("an empty snapshot produces empty lists, not a crash", () => {
  const board = buildVacancyBoard([], TODAY);
  assert.deepEqual(board, { vacant: [], upcoming: [], vacantCount: 0, upcomingCount: 0, longVacantCount: 0 });
});
