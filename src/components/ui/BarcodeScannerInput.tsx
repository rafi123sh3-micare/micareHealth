'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Scan, Search, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface PatientResult {
  id: string;
  name: string;
  phone: string | null;
  age: number | null;
  bcode: string | null;
}

interface BarcodeScannerInputProps {
  onPatientFound: (patient: PatientResult) => void;
  onClear?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function BarcodeScannerInput({
  onPatientFound,
  onClear,
  placeholder = 'বারকোড স্ক্যান করুন',
  autoFocus = false,
}: BarcodeScannerInputProps) {
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lookupPatient = useCallback(async (bcode: string) => {
    if (!bcode.trim()) return;
    setLookingUp(true);
    try {
      const { data: patient, error } = await supabase
        .from('patients')
        .select('id, name, phone, age, bcode')
        .eq('bcode', bcode.trim())
        .maybeSingle();

      if (error || !patient) {
        toast.error('কোনো রোগী খুঁজে পাওয়া যায়নি');
        return;
      }

      onPatientFound(patient);
      window.open(`https://carescriptrx.vercel.app/dashboard/doctor/prescribe?patient_id=${patient.id}`, '_blank');
    } catch {
      toast.error('সার্ভার ত্রুটি');
    } finally {
      setLookingUp(false);
      setCode('');
    }
  }, [onPatientFound]);

  useEffect(() => {
    if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    if (code.trim().length >= 4) {
      submitTimerRef.current = setTimeout(() => {
        lookupPatient(code);
      }, 150);
    }
    return () => {
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    };
  }, [code, lookupPatient]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
      lookupPatient(code);
    }
  };

  const handleClear = () => {
    setCode('');
    onClear?.();
    inputRef.current?.focus();
  };

  return (
    <div className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all ${
      scanning
        ? 'border-primary-400 bg-primary-50 shadow-sm shadow-primary-200'
        : 'border-slate-200 bg-white hover:border-slate-300'
    }`}>
      {lookingUp ? (
        <Loader2 className="w-5 h-5 text-primary-500 animate-spin shrink-0" />
      ) : (
        <Scan className={`w-5 h-5 shrink-0 transition-colors ${scanning ? 'text-primary-600' : 'text-slate-400'}`} />
      )}
      <input
        ref={inputRef}
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setScanning(true)}
        onBlur={() => setScanning(false)}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none outline-none text-sm font-mono tracking-wider text-slate-800 placeholder-slate-400 min-w-[100px]"
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {code && (
        <button
          onClick={handleClear}
          className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <button
        type="button"
        onClick={() => lookupPatient(code)}
        disabled={!code.trim() || lookingUp}
        className="p-1.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="রোগী খুঁজুন"
      >
        <Search className="w-4 h-4" />
      </button>
    </div>
  );
}
