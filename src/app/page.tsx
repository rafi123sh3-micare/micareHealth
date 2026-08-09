'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Calendar, ArrowRight } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const role = localStorage?.getItem('userRole');
    if (role === 'admin') router.push('/dashboard/admin');
    else if (role === 'appointment_taker') router.push('/dashboard/admin');
    else if (role === 'doctor') router.push('/dashboard/doctor');
    else if (role === 'patient') router.push('/dashboard/patient');
  }, [router]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen premium-bg floating-orbs">
      <div className="max-w-4xl mx-auto px-4 py-8 relative z-10">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500 via-primary-600 to-blue-600 shadow-2xl shadow-primary-500/25 mb-6">
            <Calendar className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Clinic Connect</h1>
          <p className="text-lg text-slate-600 max-w-md mx-auto">
            সহজে অ্যাপয়েন্টমেন্ট বুক করুন, ডাক্তারের সাথে কথা বলুন
          </p>
        </div>

        <div className="max-w-sm mx-auto animate-fade-up space-y-3" style={{ animationDelay: '150ms' }}>
            <Link href="/login">
              <button className="btn-primary w-full flex items-center justify-center gap-2">
                লগইন <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/register" className="block">
              <button className="btn-secondary w-full">
                নতুন অ্যাকাউন্ট তৈরি করুন
              </button>
            </Link>
          </div>
      </div>
    </div>
  );
}