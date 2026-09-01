import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { isValidVacancyCode, MIN_CODE_LENGTH } from "../lib/vacancy-link.ts";

const GOOD = "a".repeat(MIN_CODE_LENGTH);

afterEach(() => {
  delete process.env.VACANCY_LINK_CODE;
});

test("accepts the configured code", () => {
  process.env.VACANCY_LINK_CODE = GOOD;
  assert.equal(isValidVacancyCode(GOOD), true);
});

test("rejects a wrong code, including near-misses", () => {
  process.env.VACANCY_LINK_CODE = GOOD;
  assert.equal(isValidVacancyCode(`${GOOD}x`), false);
  assert.equal(isValidVacancyCode(GOOD.slice(0, -1)), false);
  assert.equal(isValidVacancyCode(GOOD.toUpperCase()), false);
  assert.equal(isValidVacancyCode(""), false);
});

test("fails closed when no code is configured", () => {
  delete process.env.VACANCY_LINK_CODE;
  assert.equal(isValidVacancyCode(""), false);
  assert.equal(isValidVacancyCode("anything"), false);
});

test("fails closed when the configured code is too short to be a secret", () => {
  process.env.VACANCY_LINK_CODE = "short";
  assert.equal(isValidVacancyCode("short"), false);
});
