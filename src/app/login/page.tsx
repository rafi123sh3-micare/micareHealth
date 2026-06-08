'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Check if the user is an admin by querying the admins table
    const { data: admin } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (admin) {
      if (password.trim() === admin.passcode) {
        localStorage.setItem('userRole', 'admin');
        localStorage.setItem('adminData', JSON.stringify(admin));
        router.push('/dashboard/admin');
        toast.success('অ্যাডমিন হিসেবে লগইন!');
        setLoading(false);
        return;
      } else {
        toast.error('ভুল পাসকোড');
        setLoading(false);
        return;
      }
    }

    const { data: doctor } = await supabase
      .from('doctors')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (doctor && doctor.passcode === password.trim()) {
      localStorage.setItem('userRole', 'doctor');
      localStorage.setItem('doctorData', JSON.stringify(doctor));
      router.push('/dashboard/doctor');
      toast.success('ডাক্তার হিসেবে লগইন!');
      setLoading(false);
      return;
    }

    const { data: patient } = await supabase
      .from('patients')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (patient && patient.password === password.trim()) {
      localStorage.setItem('userRole', 'patient');
      localStorage.setItem('patientData', JSON.stringify(patient));
      router.push('/dashboard/patient');
      toast.success('রোগী হিসেবে লগইন!');
      setLoading(false);
      return;
    }

    toast.error('ইমেইল বা পাসওয়ার্ড ভুল');
    setLoading(false);
  };

  return (
    <div className="min-h-screen premium-bg floating-orbs flex items-center justify-center p-4">
      <div className="w-full max-w-md relative z-10">
        {/* Logo & Header */}
        <div className="text-center mb-8 animate-fade-up">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500 via-primary-600 to-blue-600 shadow-2xl shadow-primary-500/25 mb-4 relative overflow-hidden group-hover:scale-105 transition-transform cursor-pointer">
            <div className="absolute inset-0 bg-white/10" />
            <span className="text-white font-bold text-3xl">CC</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Clinic Connect</h1>
          <p className="text-slate-500 mt-2">আপনার অ্যাকাউন্টে লগইন করুন</p>
        </div>

        {/* Login Card */}
        <div className="glass-card rounded-2xl p-4 sm:p-6 md:p-8 animate-fade-up" style={{ animationDelay: '100ms' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="email@example.com"
              required
            />

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full"
            >
              লগইন করুন
            </Button>
          </form>

          <p className="text-center mt-6 text-slate-600">
            নতুন অ্যাকাউন্ট?{' '}
            <Link href="/register" className="text-primary-600 font-semibold hover:text-primary-700">
              রেজিস্টার করুন
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}