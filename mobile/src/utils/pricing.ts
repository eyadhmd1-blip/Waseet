// ============================================================
// Centralized pricing & calculation utilities
// Keep ALL business-logic math here — never inline in render.
// ============================================================

import { LOYALTY_MILESTONES } from '../constants/loyalty';

// ─── Urgent Premium ──────────────────────────────────────────

export function calcUrgentPremium(
  baseMin: number | null | undefined,
  baseMax: number | null | undefined,
  premiumPct: number = 25,
): { min: number | null; max: number | null } {
  return {
    min: baseMin != null ? Math.round(baseMin * (1 + premiumPct / 100)) : null,
    max: baseMax != null ? Math.round(baseMax * (1 + premiumPct / 100)) : null,
  };
}

// ─── Contract Total ──────────────────────────────────────────

export const FREQ_VISITS: Record<string, number> = {
  weekly: 4, biweekly: 2, monthly: 1,
};

export function calcContractTotal(
  pricePerVisit: number,
  frequency: string,
  durationMonths: number,
): number {
  return pricePerVisit * (FREQ_VISITS[frequency] ?? 1) * durationMonths;
}

// ─── Loyalty Progress ────────────────────────────────────────

export function calcLoyaltyProgress(lifetimeJobs: number): {
  nextMilestone: number | null;
  prevMilestone: number;
  progress: number;
} {
  const next = LOYALTY_MILESTONES.find(m => m > lifetimeJobs) ?? null;
  const prev = LOYALTY_MILESTONES.filter(m => m <= lifetimeJobs).pop() ?? 0;
  return {
    nextMilestone: next,
    prevMilestone: prev,
    progress: next ? (lifetimeJobs - prev) / (next - prev) : 1,
  };
}

// ─── Request Status Counts (single-pass) ─────────────────────

export function calcStatusCounts<T extends { status: string }>(
  items: T[],
): { total: number; open: number; in_progress: number; completed: number; cancelled: number } {
  return items.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.status === 'open')        acc.open        += 1;
      else if (item.status === 'in_progress') acc.in_progress += 1;
      else if (item.status === 'completed')   acc.completed   += 1;
      else if (item.status === 'cancelled')   acc.cancelled   += 1;
      return acc;
    },
    { total: 0, open: 0, in_progress: 0, completed: 0, cancelled: 0 },
  );
}

// ─── Number formatting ───────────────────────────────────────

export function sanitizeAmount(text: string): string {
  const parts = text.replace(/[^0-9.]/g, '').split('.');
  return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : parts.join('.');
}
