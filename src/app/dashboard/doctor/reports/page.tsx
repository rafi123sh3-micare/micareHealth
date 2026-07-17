'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { TrendingUp, Users, Calendar, Video, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 100, damping: 15 }
  }
};

export default function DoctorReports() {
  const getLocalDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyEarnings, setDailyEarnings] = useState(0);
  const [monthlyEarnings, setMonthlyEarnings] = useState(0);
  const [dailyCompleted, setDailyCompleted] = useState(0);
  const [monthlyCompleted, setMonthlyCompleted] = useState(0);
  const [dailyTeleconsult, setDailyTeleconsult] = useState(0);
  const [monthlyTeleconsult, setMonthlyTeleconsult] = useState(0);
  const [statsViewMode, setStatsViewMode] = useState<'daily' | 'monthly'>('daily');

  const [filterDate, setFilterDate] = useState(getLocalDateString());
  const [filterMonth, setFilterMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  const [allApts, setAllApts] = useState<any[]>([]);
  const [doctorId, setDoctorId] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (allApts.length > 0) {
      calculateStats();
    }
  }, [statsViewMode, filterDate, filterMonth, allApts]);

  useEffect(() => {
    if (filterDate) {
      const dateObj = new Date(filterDate);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      setFilterMonth(`${year}-${month}`);
    }
  }, [filterDate]);

  async function loadAllData() {
    setLoading(true);
    const doctorData = JSON.parse(localStorage.getItem('doctorData') || 'null');
    if (!doctorData) { setLoading(false); return; }
    setDoctorId(doctorData.id);

    const { data } = await supabase
      .from('appointments')
      .select('*, doctors(id, name, consultation_fee), patients(id)')
      .eq('doctor_id', doctorData.id)
      .order('date', { ascending: false });

    if (data) setAllApts(data);
    setLoading(false);
  }

  function calculateStats() {
    const [year, month] = filterMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0);
    const firstDayStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

    const todayAll = allApts.filter((a: any) => a.date === filterDate && (a.status === 'confirmed' || a.status === 'completed'));
    const todayCompleted = allApts.filter((a: any) => a.date === filterDate && a.status === 'completed' && a.type !== 'teleconsult');
    const todayTele = allApts.filter((a: any) => a.date === filterDate && (a.status === 'confirmed' || a.status === 'completed') && a.type === 'teleconsult');
    const todayPatients = new Set(todayAll.map((a: any) => a.patient_id)).size;

    const monthAll = allApts.filter((a: any) => a.date >= firstDayStr && a.date <= lastDayStr && (a.status === 'confirmed' || a.status === 'completed'));
    const monthCompleted = allApts.filter((a: any) => a.date >= firstDayStr && a.date <= lastDayStr && a.status === 'completed' && a.type !== 'teleconsult');
    const monthTele = allApts.filter((a: any) => a.date >= firstDayStr && a.date <= lastDayStr && (a.status === 'confirmed' || a.status === 'completed') && a.type === 'teleconsult');
    const monthPatients = new Set(monthAll.map((a: any) => a.patient_id)).size;

    const calcEarnings = (apts: any[]) => apts.reduce((sum: number, a: any) => sum + (Number(a.doctors?.consultation_fee) || 500), 0);

    setDailyEarnings(calcEarnings(todayCompleted) + calcEarnings(todayTele));
    setMonthlyEarnings(calcEarnings(monthCompleted) + calcEarnings(monthTele));
    setDailyCompleted(calcEarnings(todayCompleted));
    setMonthlyCompleted(calcEarnings(monthCompleted));
    setDailyTeleconsult(calcEarnings(todayTele));
    setMonthlyTeleconsult(calcEarnings(monthTele));

    setStats([
      { label: 'মোট অ্যাপয়েন্টমেন্ট', value: todayAll.length, monthlyValue: monthAll.length },
      { label: 'নিশ্চিতকৃত টেলিকনসাল্ট', value: todayTele.length, monthlyValue: monthTele.length },
      { label: 'মোট সম্পন্ন', value: todayCompleted.length + todayTele.length, monthlyValue: monthCompleted.length + monthTele.length },
      { label: 'মোট রোগী', value: todayPatients, monthlyValue: monthPatients },
    ]);
  }

  if (loading) {
    return (
      <DashboardLayout role="doctor">
        <div className="space-y-6">
          <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-200 rounded-xl animate-pulse" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="doctor">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">রিপোর্ট</h1>
            <p className="text-slate-500">আপনার পরিসংখ্যান</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setStatsViewMode('daily');
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <button
              onClick={() => { setFilterDate(getLocalDateString()); setStatsViewMode('daily'); }}
              className="px-4 py-2 text-white rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-600 transition shadow-md text-sm font-medium"
            >
              Today
            </button>
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button onClick={() => setStatsViewMode('daily')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${statsViewMode === 'daily' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'}`}>
                আজকের
              </button>
              <button onClick={() => setStatsViewMode('monthly')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${statsViewMode === 'monthly' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'}`}>
                মাসিক
              </button>
            </div>
          </div>
        </div>

        <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.length > 0 ? stats.map((stat) => (
            <motion.div whileHover={{ scale: 1.02 }} key={stat.label} className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {statsViewMode === 'daily' ? stat.value : stat.monthlyValue}
              </p>
            </motion.div>
          )) : (
            <div className="col-span-4 text-center py-4 text-slate-400">কোনো ডেটা নেই</div>
          )}
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-xl">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-emerald-100 text-sm">আয়</p>
                  <p className="text-3xl font-bold">
                    ৳{statsViewMode === 'daily' ? dailyEarnings.toLocaleString() : monthlyEarnings.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3 pt-2">
              {statsViewMode === 'daily' ? (
                <>
                  <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                    <span className="text-emerald-100">সম্পন্ন সরাসরি অ্যাপয়েন্টমেন্ট</span>
                    <span className="font-semibold">৳{dailyCompleted.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                    <span className="text-emerald-100">নিশ্চিতকৃত টেলিকনসাল্ট</span>
                    <span className="font-semibold">৳{dailyTeleconsult.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white/20 rounded-lg p-3">
                    <span className="text-white font-medium">মোট</span>
                    <span className="text-white font-bold">৳{dailyEarnings.toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                    <span className="text-emerald-100">সম্পন্ন সরাসরি অ্যাপয়েন্টমেন্ট</span>
                    <span className="font-semibold">৳{monthlyCompleted.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                    <span className="text-emerald-100">নিশ্চিতকৃত টেলিকনসাল্ট</span>
                    <span className="font-semibold">৳{monthlyTeleconsult.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white/20 rounded-lg p-3">
                    <span className="text-white font-medium">মোট</span>
                    <span className="text-white font-bold">৳{monthlyEarnings.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
