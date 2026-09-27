'use client';

import { useState } from 'react';
import { Calendar, Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

export type PeriodMode = 'day' | 'month' | 'dayRange' | 'monthRange';

export interface ReportPeriod {
  mode: PeriodMode;
  start: string;
  end: string;
  label: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const currentMonthValue = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

function monthBounds(monthValue: string): { start: string; end: string } {
  const [y, m] = monthValue.split('-').map(Number);
  const lastDay = new Date(y, m, 0);
  return { start: `${y}-${pad(m)}-01`, end: toDateStr(lastDay) };
}

export function defaultDayPeriod(iso?: string): ReportPeriod {
  const t = iso || toDateStr(new Date());
  return { mode: 'day', start: t, end: t, label: formatDay(t) };
}

export function isInPeriod(date: string, period: ReportPeriod) {
  return !!date && date >= period.start && date <= period.end;
}

function formatDay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${d} ${new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'long' })} ${y}`;
}

function formatMonth(monthValue: string): string {
  if (!monthValue) return '';
  const [y, m] = monthValue.split('-').map(Number);
  if (!y || !m) return '';
  return new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

const MODE_OPTIONS: { value: PeriodMode; label: string; hint: string }[] = [
  { value: 'day', label: 'একটি তারিখ', hint: 'নির্দিষ্ট একদিনের রিপোর্ট' },
  { value: 'month', label: 'একটি মাস', hint: 'নির্দিষ্ট মাসের রিপোর্ট' },
  { value: 'dayRange', label: 'তারিখের রেঞ্জ', hint: 'শুরু ও শেষ তারিখ দিয়ে' },
  { value: 'monthRange', label: 'মাসের রেঞ্জ', hint: 'শুরু ও শেষ মাস দিয়ে' },
];

export default function ReportPeriodFilter({
  period,
  onChange,
}: {
  period: ReportPeriod;
  onChange: (next: ReportPeriod) => void;
}) {
  const [open, setOpen] = useState(false);

  // Draft state — only committed to the parent on apply, so a half-typed
  // range never silently changes the report.
  const [mode, setMode] = useState<PeriodMode>(period.mode);
  const [day, setDay] = useState(period.mode === 'day' ? period.start : toDateStr(new Date()));
  const [month, setMonth] = useState(period.mode === 'month' ? period.start.slice(0, 7) : currentMonthValue());
  const [rangeStart, setRangeStart] = useState(period.mode === 'dayRange' ? period.start : toDateStr(new Date()));
  const [rangeEnd, setRangeEnd] = useState(period.mode === 'dayRange' ? period.end : toDateStr(new Date()));
  const [monthStart, setMonthStart] = useState(period.mode === 'monthRange' ? period.start.slice(0, 7) : currentMonthValue());
  const [monthEnd, setMonthEnd] = useState(period.mode === 'monthRange' ? period.end.slice(0, 7) : currentMonthValue());

  const [error, setError] = useState('');

  const openPicker = () => {
    // Re-seed the draft from whatever is currently applied.
    setMode(period.mode);
    if (period.mode === 'day') setDay(period.start);
    if (period.mode === 'month') setMonth(period.start.slice(0, 7));
    if (period.mode === 'dayRange') {
      setRangeStart(period.start);
      setRangeEnd(period.end);
    }
    if (period.mode === 'monthRange') {
      setMonthStart(period.start.slice(0, 7));
      setMonthEnd(period.end.slice(0, 7));
    }
    setError('');
    setOpen(true);
  };

  const apply = () => {
    let next: ReportPeriod;

    if (mode === 'day') {
      if (!day) return setError('একটি তারিখ নির্বাচন করুন');
      next = { mode, start: day, end: day, label: formatDay(day) };
    } else if (mode === 'month') {
      if (!month) return setError('একটি মাস নির্বাচন করুন');
      const b = monthBounds(month);
      next = { mode, start: b.start, end: b.end, label: formatMonth(month) };
    } else if (mode === 'dayRange') {
      if (!rangeStart || !rangeEnd) return setError('শুরু ও শেষ তারিখ দুটোই দিন');
      if (rangeStart > rangeEnd) return setError('শুরুর তারিখ শেষের তারিখের আগে হতে হবে');
      const label = rangeStart === rangeEnd
        ? formatDay(rangeStart)
        : `${formatDay(rangeStart)} - ${formatDay(rangeEnd)}`;
      next = { mode, start: rangeStart, end: rangeEnd, label };
    } else {
      if (!monthStart || !monthEnd) return setError('শুরু ও শেষ মাস দুটোই দিন');
      if (monthStart > monthEnd) return setError('শুরুর মাস শেষের মাসের আগে হতে হবে');
      const a = monthBounds(monthStart);
      const b = monthBounds(monthEnd);
      const label = monthStart === monthEnd
        ? formatMonth(monthStart)
        : `${formatMonth(monthStart)} - ${formatMonth(monthEnd)}`;
      next = { mode, start: a.start, end: b.end, label };
    }

    onChange(next);
    setOpen(false);
  };

  const todayPeriod = (): ReportPeriod => {
    const t = toDateStr(new Date());
    return { mode: 'day', start: t, end: t, label: formatDay(t) };
  };

  return (
    <>
      {/* Calendar button + the currently applied period, side by side */}
      <div className="flex items-center gap-2">
        <button
          onClick={openPicker}
          title="সময়সীমা নির্বাচন করুন"
          className="p-2.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition"
        >
          <Calendar className="w-5 h-5" />
        </button>

        <button
          onClick={openPicker}
          title="সময়সীমা পরিবর্তন করুন"
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 transition text-left"
        >
          <span className="block text-[10px] uppercase tracking-wide text-slate-500 leading-tight">
            {MODE_OPTIONS.find((m) => m.value === period.mode)?.label}
          </span>
          <span className="block leading-tight">{period.label}</span>
        </button>

        <button
          onClick={() => onChange(todayPeriod())}
          className="px-4 py-2 text-white rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-600 transition shadow-md text-sm font-medium"
        >
          আজ
        </button>
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="রিপোর্টের সময়সীমা বাছুন" size="sm">
        <p className="text-sm text-slate-500 mb-4">কোন ধরনের সময়সীমা দিয়ে রিপোর্ট দেখতে চান?</p>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={`p-3 rounded-xl border text-left transition ${
                mode === opt.value
                  ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-800 text-sm">{opt.label}</span>
                {mode === opt.value && <Check className="w-4 h-4 text-primary-600 shrink-0" />}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{opt.hint}</p>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {mode === 'day' && (
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1.5">তারিখ</label>
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          )}

          {mode === 'month' && (
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1.5">মাস</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          )}

          {mode === 'dayRange' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-1.5">শুরুর তারিখ</label>
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-1.5">শেষের তারিখ</label>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
          )}

          {mode === 'monthRange' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-1.5">শুরুর মাস</label>
                <input
                  type="month"
                  value={monthStart}
                  onChange={(e) => setMonthStart(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-1.5">শেষের মাস</label>
                <input
                  type="month"
                  value={monthEnd}
                  onChange={(e) => setMonthEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition text-sm font-medium"
            >
              বাতিল
            </button>
            <button
              onClick={apply}
              className="px-5 py-2 rounded-lg text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-600 transition shadow-md text-sm font-medium"
            >
              প্রয়োগ করুন
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
