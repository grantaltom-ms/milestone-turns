# AppFolio Report Endpoints

All endpoints follow the same base pattern from `auth-and-client.md`. Import and call `fetchReport<T>("report_name", filters)`.

---

## unit_vacancy

**When to use:** Nightly sync to find which units are vacant/notice and need turns created.

```typescript
export type AppfolioUnitStatus =
  | "Vacant-Unrented"
  | "Vacant-Rented"
  | "Notice-Unrented"
  | "Notice-Rented";

export interface UnitVacancyRow {
  property_id: number;
  property_name: string;
  unit: string;
  unit_id: number;
  unit_status: AppfolioUnitStatus | string;
  last_move_out: string | null;        // "YYYY-MM-DD"
  computed_market_rent: string | null;
  sqft: number | null;
  bed_and_bath: string | null;         // e.g. "2/1"
  rent_ready: string | null;
  next_move_in: string | null;         // only populated when Vacant-Rented
  days_vacant: number | null;
  available_on: string | null;
  unit_turn_target_date: string | null;
}

const rows = await fetchReport<UnitVacancyRow>("unit_vacancy");
// No filters required — returns all properties the API client has access to
```

---

## income_statement

**When to use:** Monthly financial reports per property. Requires a date range.

```typescript
export interface IncomeStatementRow {
  property_id: number;
  property_name: string;
  account_name: string;
  account_type: string;     // "Revenue" | "Expense" | etc.
  account_number: string | null;
  period_amount: number;    // amount for the requested period
  ytd_amount: number;       // year-to-date amount
}

const rows = await fetchReport<IncomeStatementRow>("income_statement", {
  from_date: "2025-01-01",   // "YYYY-MM-DD"
  to_date: "2025-01-31",
  // property_ids: [123, 456], // optional: filter to specific properties
});
```

**Note:** `period_amount` and `ytd_amount` may be strings in some API versions — parse with `parseFloat()` if needed.

---

## balance_sheet

**When to use:** Point-in-time balance sheet for a property or portfolio.

```typescript
export interface BalanceSheetRow {
  property_id: number;
  property_name: string;
  account_name: string;
  account_type: string;     // "Asset" | "Liability" | "Equity"
  account_number: string | null;
  balance: number;
}

const rows = await fetchReport<BalanceSheetRow>("balance_sheet", {
  as_of_date: "2025-01-31",  // "YYYY-MM-DD" — point-in-time snapshot
  // property_ids: [123, 456],
});
```

---

## delinquency

**When to use:** Pull current tenant delinquencies (past-due rent/charges).

```typescript
export interface DelinquencyRow {
  property_id: number;
  property_name: string;
  unit: string;
  tenant_name: string;
  lease_id: number;
  charge_type: string;      // "Rent" | "Late Fee" | etc.
  charge_date: string;      // "YYYY-MM-DD"
  amount_due: number;
  amount_paid: number;
  balance: number;
  days_past_due: number;
}

const rows = await fetchReport<DelinquencyRow>("delinquency", {
  as_of_date: "2025-01-31",  // omit for current date
  // include_future_charges: false,
});
```

---

## general_ledger

**When to use:** Full transaction-level accounting data for a date range.

```typescript
export interface GeneralLedgerRow {
  property_id: number;
  property_name: string;
  account_name: string;
  account_number: string | null;
  transaction_date: string;  // "YYYY-MM-DD"
  description: string;
  reference: string | null;
  debit: number | null;
  credit: number | null;
  balance: number;
  payee: string | null;
}

const rows = await fetchReport<GeneralLedgerRow>("general_ledger", {
  from_date: "2025-01-01",
  to_date: "2025-01-31",
  // property_ids: [123, 456],
  // account_ids: [789],      // filter to specific GL accounts
});
```

**Warning:** General ledger can return very large datasets for long date ranges across many properties. Always scope to a narrow date range or filter by property.

---

## work_order

**When to use:** Pull maintenance work orders (open, completed, or all).

```typescript
export interface WorkOrderRow {
  work_order_id: number;
  property_id: number;
  property_name: string;
  unit: string | null;
  description: string;
  status: string;           // "Open" | "Closed" | "In Progress" | etc.
  priority: string | null;  // "Emergency" | "Urgent" | "Normal" | "Low"
  created_date: string;     // "YYYY-MM-DD"
  completed_date: string | null;
  category: string | null;
  assigned_to: string | null;
  vendor: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
}

const rows = await fetchReport<WorkOrderRow>("work_order", {
  from_date: "2025-01-01",  // filter by created_date
  to_date: "2025-12-31",
  // status: "Open",          // filter by status
  // property_ids: [123],
});
```

---

## Field schema notes

- Field names are snake_case in all AppFolio v2 report responses
- Numeric fields (costs, balances, rents) may arrive as strings in some report versions — always `parseFloat()` or `Number()` when storing in a typed schema
- Date fields are always `"YYYY-MM-DD"` strings
- `property_id` is AppFolio's internal property ID (integer), not your Supabase property ID — you'll need a mapping table to join them
- The field schemas above are based on known AppFolio v2 report output; actual column names may vary slightly by account configuration — log the raw response the first time you connect and verify against actual field names
