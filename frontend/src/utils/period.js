// Financial-year-aware period resolution — a frontend mirror of
// backend/src/utils/period.js (kept in sync by hand; no shared module
// boundary exists between the CJS backend and the Vite frontend). Indian
// financial year: 1 April to 31 March.

function toIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fyStartYear(date = new Date()) {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

function fyLabel(startYear) {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

const QUARTERS = [
  { q: 1, label: 'Q1 · Apr – Jun', months: [3, 4, 5] },
  { q: 2, label: 'Q2 · Jul – Sep', months: [6, 7, 8] },
  { q: 3, label: 'Q3 · Oct – Dec', months: [9, 10, 11] },
  { q: 4, label: 'Q4 · Jan – Mar', months: [0, 1, 2] },
];
const HALVES = [
  { h: 1, label: 'First Half · Apr – Sep', months: [3, 4, 5, 6, 7, 8] },
  { h: 2, label: 'Second Half · Oct – Mar', months: [9, 10, 11, 0, 1, 2] },
];

// mode: 'FYC' | 'FYP' | 'Q' | 'H' | 'C' (custom) | 'ALL'
export function resolvePeriod({ mode, fy, q, h, from, to } = {}) {
  const now = new Date();
  const curFyStart = fyStartYear(now);

  if (mode === 'ALL' || !mode) {
    return { from: null, to: null, label: 'All time' };
  }
  if (mode === 'C') {
    return { from: from || null, to: to || null, label: from || to ? `${from || '…'} to ${to || '…'}` : 'Custom Date' };
  }
  const startYear = mode === 'FYP' ? curFyStart - 1 : fy ? Number(fy) : curFyStart;
  const fyFrom = new Date(startYear, 3, 1);
  const fyTo = new Date(startYear + 1, 2, 31);

  if (mode === 'Q') {
    const quarter = QUARTERS.find((x) => x.q === Number(q)) || QUARTERS[0];
    const yOffset = quarter.q === 4 ? 1 : 0;
    const qFrom = new Date(startYear + (quarter.months[0] < 3 ? yOffset : 0), quarter.months[0], 1);
    const qToMonth = quarter.months[2];
    const qTo = new Date(startYear + (qToMonth < 3 ? yOffset : 0), qToMonth + 1, 0);
    return { from: toIso(qFrom), to: toIso(qTo), label: `${quarter.label} · FY ${fyLabel(startYear)}` };
  }
  if (mode === 'H') {
    const half = HALVES.find((x) => x.h === Number(h)) || HALVES[0];
    const hFromMonth = half.months[0];
    const hToMonth = half.months[half.months.length - 1];
    const hFrom = new Date(startYear + (hFromMonth < 3 ? 0 : 0), hFromMonth, 1);
    const hTo = new Date(startYear + (hToMonth < 3 ? 1 : 0), hToMonth + 1, 0);
    return { from: toIso(hFrom), to: toIso(hTo), label: `${half.label} · FY ${fyLabel(startYear)}` };
  }
  return {
    from: toIso(fyFrom),
    to: toIso(fyTo),
    label: mode === 'FYP' ? 'Previous Financial Year' : mode === 'FYC' ? 'Current Financial Year' : `FY ${fyLabel(startYear)}`,
  };
}
