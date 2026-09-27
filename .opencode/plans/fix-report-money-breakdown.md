# Fix Report Page: `সম্পন্ন সরাসরি আপয়েন্টমেন্ট` shows ৳0 and the card does not reconcile

## Problem

The report income card shows:

```
আয়                                ৳30,100
সম্পন্ন সরাসরি আপয়েন্টমেন্ট              ৳0
নিশ্চিতকৃত টেলিকনসাল্ট               ৳0
যোগ করা টাকা                      ৳0
রিফান্ড (Refund)                 ৳1,000
মোট                              ৳30,100
```

Both breakdown rows read ৳0 while the total reads ৳30,100.

## Root Cause

**1. Asymmetric status filter between the two breakdown rows.**
`সম্পন্ন সরাসরি` filters `status === 'completed'` only. `নিশ্চিতকৃত টেলিকনসাল্ট`
filters `status === 'confirmed' || status === 'completed'`. Appointments that are
`confirmed` but not yet marked complete are counted in the income total but
appear in neither visible row.

**2. `মোট` is a duplicate of `আয়`, not a sum of the rows.**
Both render the identical expression. The breakdown rows are never added
together.

**3. The earnings total ignores `status` and `type` entirely.**
It sums over *all* appointments on the date, including `cancelled` and
`pending`, while the breakdown rows apply status filters. That is why ৳30,100
sits in the headline but nowhere in the breakdown.

## Confirmed Diagnosis

আয় ৳30,100 and both rows ৳0 is only possible if **`paid` is populated but no
appointment has `status = 'completed'`**. If the rows read ৳0 because `paid` were
0, the headline would read ৳0 too — all three figures read the same column.
So relaxing the status filter is what makes the rows populate; no backfill is
needed.

## Files to Change

- `src/app/dashboard/admin/reports/page.tsx`
- `src/app/dashboard/doctor/reports/page.tsx`

Both carry the identical defect. The admin card additionally has the
যোগ করা টাকা and রিফান্ড rows.

## Changes

### 1. One shared status predicate

Inside `calculateStats()`, so the rule cannot drift between rows again:

```ts
const isEarning = (a: any) => a.status === 'confirmed' || a.status === 'completed';
```

This excludes `pending` and `cancelled` from all money figures.

### 2. Two disjoint buckets split by type

```ts
const todayInPerson = allApts.filter((a: any) => a.date === filterDate && isEarning(a) && a.type !== 'teleconsult');
const todayTele      = allApts.filter((a: any) => a.date === filterDate && isEarning(a) && a.type === 'teleconsult');
// + monthInPerson / monthTele across firstDayStr..lastDayStr
```

Mutually exclusive and jointly exhaustive over the earning population, which is
what makes the sum correct.

### 3. Money metric is the `paid` column, summed

Per your decision — no refund subtraction anywhere, since refund is already
handled on the appointments page:

```ts
const calcPaid = (apts: any[]) => apts.reduce((sum: number, a: any) => sum + (Number(a.paid) || 0), 0);

setDailyCompleted(calcPaid(todayInPerson));
setMonthlyCompleted(calcPaid(monthInPerson));
setDailyTeleconsult(calcPaid(todayTele));
setMonthlyTeleconsult(calcPaid(monthTele));
setDailyEarnings(calcPaid([...todayInPerson, ...todayTele]));
setMonthlyEarnings(calcPaid([...monthInPerson, ...monthTele]));
```

`calcEarnings` (the `paid - refunded` version) is replaced by `calcPaid` and
removed.

### 4. `মোট` becomes an actual sum in the JSX

Admin, `page.tsx:423` and the monthly twin:

```tsx
৳{(dailyCompleted + dailyTeleconsult + dailyAddedMoney).toLocaleString()}
```

Doctor, `page.tsx:223` and `page.tsx:238`:

```tsx
৳{(dailyCompleted + dailyTeleconsult).toLocaleString()}
```

By construction this now equals the `আয়` headline, so the card always
reconciles.

### 5. Preserve the count sets for the stat cards

The `মোট সম্পন্ন` stat card means *actually completed* and must not silently
become "all confirmed". Keep the current count-only sets, renamed:

```ts
const todayCompletedCount = allApts.filter((a: any) => a.date === filterDate && a.status === 'completed' && a.type !== 'teleconsult');
```

`মোট সম্পন্ন` keeps using these counts — behaviour unchanged.

### 6. The রিফান্ড row stays display-only

It continues to read `refunded` directly and is not part of any sum, per your
instruction. Label it as informational so it is not read as a deduction from
মোট.

### 7. Fix the silent all-zeros guard

Admin `page.tsx:79`:

```ts
if (allApts.length > 0 && allDoctors.length > 0) { calculateStats(); }
```

If the `doctors` query returns empty or is RLS-blocked, `calculateStats()` never
runs and every figure stays frozen at its `useState(0)` default — visually
identical to a genuine zero. Replace the length check with a `loaded` flag set at
the end of `loadAllData()`.

## Expected Result

`সম্পন্ন সরাসরি আপয়েন্টমেন্ট` populates with the `paid` total of today's
confirmed/completed in-person appointments, and the rows sum exactly to মোট.

## Caveat to Expect

Because `pending` and `cancelled` are now excluded, the headline may land
**below** ৳30,100 if any of that figure belongs to appointments still marked
pending or cancelled. That is the correction working as intended — the old
৳30,100 was counting money from appointments that are not confirmed. If the new
headline looks too low, the cause is unpaid/pending records, and I can supply
SQL to list them.

## Out of Scope

- `paid` is never written by `handleComplete` (`admin/appointments/page.tsx:782`
  only sets `status`). Completing an appointment without editing its invoice
  leaves `paid` at 0, so that appointment contributes ৳0 to the report. This is
  the reason the row can drift back toward zero over time; a separate payments
  fix would be needed to close it permanently.
- `getFeeAmount` (`supabase.ts:81`) is a flat hardcoded table — `new` ৳1000,
  `follow_up` ৳700, `report` ৳0 — and ignores each doctor's own
  `consultation_fee`. Not touched.
- The `transactions` table is RLS-restricted to admins, so a non-admin session
  reads zero added-money rows with no error. Not touched.
