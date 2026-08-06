'use client';

import React, { forwardRef } from 'react';
import DatePicker from 'react-datepicker';
import { Calendar } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';

interface DatePickerProps {
  value?: string;
  onChange: (date: string) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  disabled?: boolean;
}

const DatePickerInput = forwardRef<HTMLInputElement, any>(({ value, onClick, ...props }, ref) => (
  <div className="relative">
    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    <input
      ref={ref}
      type="text"
      value={value || ''}
      onClick={onClick}
      readOnly
      className={`
        w-full pl-10 pr-4 py-3 rounded-xl border bg-white text-slate-900
        border-slate-300 hover:border-slate-400
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
        transition-all duration-200 cursor-pointer
        placeholder:text-slate-400
        disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
        ${props.className || ''}
      `}
      placeholder={props.placeholder || 'তারিখ নির্বাচন করুন'}
    />
  </div>
));

DatePickerInput.displayName = 'DatePickerInput';

function parseDateString(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function DatePickerComponent({
  value,
  onChange,
  placeholder,
  minDate,
  maxDate,
  className,
  disabled = false
}: DatePickerProps) {
  const selectedDate = parseDateString(value || '');

  const handleChange = (date: Date | null) => {
    if (date) {
      onChange(formatDate(date));
    } else {
      onChange('');
    }
  };

  return (
    <DatePicker
      selected={selectedDate}
      onChange={handleChange}
      minDate={minDate}
      maxDate={maxDate}
      disabled={disabled}
      dateFormat="dd/MM/yyyy"
      showMonthDropdown
      showYearDropdown
      dropdownMode="scroll"
      popperClassName="!z-[9999]"
      portalId="datepicker-portal"
      customInput={<DatePickerInput className={className} placeholder={placeholder} />}
      calendarClassName="!rounded-xl !shadow-xl !border !border-slate-200 !p-3"
    />
  );
}