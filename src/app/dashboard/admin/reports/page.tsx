'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { TrendingUp, Users, Calendar, Video, Wallet, Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

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

export default function AdminReports() {
  const getLocalDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [stats, setStats] = useState<any[]>([]);
  const [doctorStats, setDoctorStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyEarnings, setDailyEarnings] = useState(0);
  const [monthlyEarnings, setMonthlyEarnings] = useState(0);
  const [dailyCompleted, setDailyCompleted] = useState(0);
  const [monthlyCompleted, setMonthlyCompleted] = useState(0);
  const [dailyTeleconsult, setDailyTeleconsult] = useState(0);
  const [monthlyTeleconsult, setMonthlyTeleconsult] = useState(0);
  const [statsViewMode, setStatsViewMode] = useState<'daily' | 'monthly'>('daily');
  const [moneyViewMode, setMoneyViewMode] = useState<'daily' | 'monthly'>('daily');
  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [addedAmount, setAddedAmount] = useState('');
  const [addingMoney, setAddingMoney] = useState(false);
  const [dailyAddedMoney, setDailyAddedMoney] = useState(0);
  const [monthlyAddedMoney, setMonthlyAddedMoney] = useState(0);
  
  const [filterDate, setFilterDate] = useState(getLocalDateString());
  const [filterMonth, setFilterMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  // Cache all data
  const [allApts, setAllApts] = useState<any[]>([]);
  const [allDoctors, setAllDoctors] = useState<any[]>([]);
  const [addedMoneyData, setAddedMoneyData] = useState<any[]>([]);

  // Load all data once
  useEffect(() => {
    loadAllData();
  }, []);

  // Recalculate when filters or data changes (instant, no DB call)
  useEffect(() => {
    if (allApts.length > 0 && allDoctors.length > 0) {
      calculateStats();
    }
  }, [statsViewMode, filterDate, filterMonth, allApts, allDoctors]);

  // Auto-update month when date changes
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
    
    const [aptsResult, doctorsResult, moneyResult] = await Promise.all([
      supabase.from('appointments').select('*, doctors(id, name, consultation_fee), patients(id)').order('date', { ascending: false }),
      supabase.from('doctors').select('id, name, consultation_fee').order('name'),
      supabase.from('transactions').select('amount, date').eq('type', 'added')
    ]);

    if (aptsResult.data) setAllApts(aptsResult.data);
    if (doctorsResult.data) setAllDoctors(doctorsResult.data);
    if (moneyResult.data) setAddedMoneyData(moneyResult.data);
    
    setLoading(false);
  }

  function calculateStats() {
    // Month date range
    const [year, month] = filterMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const firstDayStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

    // Daily stats
    const todayAll = allApts.filter((a: any) => a.date === filterDate && (a.status === 'confirmed' || a.status === 'completed'));
    const todayCompleted = allApts.filter((a: any) => a.date === filterDate && a.status === 'completed' && a.type !== 'teleconsult');
    const todayTele = allApts.filter((a: any) => a.date === filterDate && (a.status === 'confirmed' || a.status === 'completed') && a.type === 'teleconsult');
    const todayPatients = new Set(todayAll.map((a: any) => a.patient_id)).size;

    // Monthly stats
    const monthAll = allApts.filter((a: any) => a.date >= firstDayStr && a.date <= lastDayStr && (a.status === 'confirmed' || a.status === 'completed'));
    const monthCompleted = allApts.filter((a: any) => a.date >= firstDayStr && a.date <= lastDayStr && a.status === 'completed' && a.type !== 'teleconsult');
    const monthTele = allApts.filter((a: any) => a.date >= firstDayStr && a.date <= lastDayStr && (a.status === 'confirmed' || a.status === 'completed') && a.type === 'teleconsult');
    const monthPatients = new Set(monthAll.map((a: any) => a.patient_id)).size;

    // Earnings — sum net (paid - refunded) from all appointments, regardless of status
    const calcEarnings = (apts: any[]) => apts.reduce((sum: number, a: any) => sum + ((Number(a.paid) || 0) - (Number(a.refunded) || 0)), 0);

    const todayAllForEarnings = allApts.filter((a: any) => a.date === filterDate);
    const monthAllForEarnings = allApts.filter((a: any) => a.date >= firstDayStr && a.date <= lastDayStr);

    const dTotal = calcEarnings(todayAllForEarnings);
    const mTotal = calcEarnings(monthAllForEarnings);

    setDailyEarnings(dTotal);
    setMonthlyEarnings(mTotal);
    setDailyCompleted(calcEarnings(todayCompleted));
    setMonthlyCompleted(calcEarnings(monthCompleted));
    setDailyTeleconsult(calcEarnings(todayTele));
    setMonthlyTeleconsult(calcEarnings(monthTele));

    // Added money
    const dAdded = addedMoneyData.filter((t: any) => t.date === filterDate).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
    const mAdded = addedMoneyData.filter((t: any) => t.date >= firstDayStr && t.date <= lastDayStr).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
    setDailyAddedMoney(dAdded);
    setMonthlyAddedMoney(mAdded);

    // Stats cards
    setStats([
      { label: 'মোট অ্যাপয়েন্টমেন্ট', value: todayAll.length, monthlyValue: monthAll.length },
      { label: 'নিশ্চিতকৃত টেলিকনসাল্ট', value: todayTele.length, monthlyValue: monthTele.length },
      { label: 'মোট সম্পন্ন', value: todayCompleted.length + todayTele.length, monthlyValue: monthCompleted.length + monthTele.length },
      { label: 'মোট রোগী', value: todayPatients, monthlyValue: monthPatients },
    ]);

    // Doctor stats
    const docStats = allDoctors.map((doc: any) => {
      const filtered = statsViewMode === 'daily'
        ? allApts.filter((a: any) => a.doctor_id === doc.id && a.date === filterDate)
        : allApts.filter((a: any) => a.doctor_id === doc.id && a.date >= firstDayStr && a.date <= lastDayStr);
      return {
        name: doc.name,
        appointments: filtered.length,
        teleconsult: filtered.filter((a: any) => a.type === 'teleconsult' && (a.status === 'confirmed' || a.status === 'completed')).length,
        completed: filtered.filter((a: any) => a.status === 'completed').length,
      };
    });
    setDoctorStats(docStats);
  }

  async function handleAddMoney() {
    const amount = Number(addedAmount);
    if (!amount || amount <= 0) {
      toast.error('সঠিক পরিমাণ লিখুন');
      return;
    }

    setAddingMoney(true);
    const adminData = JSON.parse(localStorage.getItem('adminData') || 'null');

    const { error } = await supabase.from('transactions').insert({
      type: 'added',
      amount: amount,
      date: getLocalDateString(),
      description: `অ্যাডমিন দ্বারা যোগ করা - ${adminData?.name || 'Admin'}`,
    });

    if (error) {
      toast.error('টাকা যোগ করতে ব্যর্থ');
    } else {
      toast.success('টাকা যোগ হয়েছে');
      setShowAddMoneyModal(false);
      setAddedAmount('');
      // Reload money data
      const { data } = await supabase.from('transactions').select('amount, date').eq('type', 'added');
      if (data) setAddedMoneyData(data);
    }
    setAddingMoney(false);
  }

  if (loading) {
    return (
      <DashboardLayout role="admin">
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
    <DashboardLayout role="admin">
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">রিপোর্ট</h1>
            <p className="text-slate-500">ক্লিনিকের পরিসংখ্যান</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Filter */}
            <input
              type="date"
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setStatsViewMode('daily');
                setMoneyViewMode('daily');
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            
            <button
              onClick={() => {
                const today = getLocalDateString();
                setFilterDate(today);
                setStatsViewMode('daily');
                setMoneyViewMode('daily');
              }}
              className="px-4 py-2 text-white rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-600 transition shadow-md text-sm font-medium"
            >
              Today
            </button>
            
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => {
                  setStatsViewMode('daily');
                  setMoneyViewMode('daily');
                }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  statsViewMode === 'daily' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'
                }`}
              >
                আজকের
              </button>
              <button
                onClick={() => {
                  setStatsViewMode('monthly');
                  setMoneyViewMode('monthly');
                }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  statsViewMode === 'monthly' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'
                }`}
              >
                মাসিক
              </button>
            </div>
          </div>
        </div>

        <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.length > 0 ? stats.map((stat) => (
            <motion.div 
              whileHover={{ scale: 1.02 }}
              key={stat.label} 
              className="card"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {statsViewMode === 'daily' ? stat.value : stat.monthlyValue}
              </p>
            </motion.div>
          )) : (
            <div className="col-span-4 text-center py-4 text-slate-400">
              কোনো ডেটা নেই
            </div>
          )}
        </motion.div>

        <motion.div variants={itemVariants} className="grid lg:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-xl">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-emerald-100 text-sm">আয়</p>
                  <p className="text-3xl font-bold">
                    ৳{moneyViewMode === 'daily' ? (dailyEarnings + dailyAddedMoney).toLocaleString() : (monthlyEarnings + monthlyAddedMoney).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddMoneyModal(true)}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title="টাকা যোগ করুন"
              >
                <Plus className="w-5 h-5" />
              </button>
              <div className="flex bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => setMoneyViewMode('daily')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    moneyViewMode === 'daily' ? 'bg-white text-emerald-600' : 'text-white/70 hover:text-white'
                  }`}
                >
                  আজকের
                </button>
                <button
                  onClick={() => setMoneyViewMode('monthly')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    moneyViewMode === 'monthly' ? 'bg-white text-emerald-600' : 'text-white/70 hover:text-white'
                  }`}
                >
                  মাসিক
                </button>
              </div>
            </div>
            <div className="space-y-3 pt-2">
              {moneyViewMode === 'daily' ? (
                <>
                  <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                    <span className="text-emerald-100">সম্পন্ন সরাসরি আপয়েন্টমেন্ট</span>
                    <span className="font-semibold">৳{dailyCompleted.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                    <span className="text-emerald-100">নিশ্চিতকৃত টেলিকনসাল্ট</span>
                    <span className="font-semibold">৳{dailyTeleconsult.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                    <span className="text-emerald-100">যোগ করা টাকা</span>
                    <span className="font-semibold">৳{dailyAddedMoney.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white/20 rounded-lg p-3">
                    <span className="text-white font-medium">মোট</span>
                    <span className="text-white font-bold">৳{(dailyEarnings + dailyAddedMoney).toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                    <span className="text-emerald-100">সম্পন্ন সরাসরি আপয়েন্টমেন্ট</span>
                    <span className="font-semibold">
                      ৳{monthlyCompleted.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                    <span className="text-emerald-100">নিশ্চিতকৃত টেলিকনসাল্ট</span>
                    <span className="font-semibold">
                      ৳{monthlyTeleconsult.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                    <span className="text-emerald-100">যোগ করা টাকা</span>
                    <span className="font-semibold">
                      ৳{monthlyAddedMoney.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-white/20 rounded-lg p-3">
                    <span className="text-white font-medium">মোট</span>
                    <span className="text-white font-bold">
                      ৳{(monthlyEarnings + monthlyAddedMoney).toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-slate-900 mb-4">ডাক্তার অনুযায়ী ({statsViewMode === 'daily' ? 'আজকের' : 'মাসিক'})</h2>
            {doctorStats.length > 0 ? (
              <div className="space-y-3">
                {doctorStats.map((doc) => (
                  <div key={doc.name} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-900">{doc.name}</span>
                      <span className="text-sm text-slate-500">{doc.appointments} অ্যাপয়েন্টমেন্ট</span>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-purple-600 flex items-center gap-1">
                        <Video className="w-3 h-3" /> {doc.teleconsult}
                      </span>
                      <span className="text-emerald-600 flex items-center gap-1">
                        <Users className="w-3 h-3" /> {doc.completed} সম্পন্ন
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                কোনো ডাক্তার নেই
              </div>
            )}
          </Card>
        </motion.div>

        <Modal isOpen={showAddMoneyModal} onClose={() => setShowAddMoneyModal(false)} title="টাকা যোগ করুন">
          <div className="space-y-4">
            <div>
              <label className="label">পরিমাণ (টাকা)</label>
              <input
                type="number"
                value={addedAmount}
                onChange={(e) => setAddedAmount(e.target.value)}
                className="input"
                placeholder="৳০"
                min="0"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowAddMoneyModal(false)} className="flex-1">
                বাতিল
              </Button>
              <Button onClick={handleAddMoney} loading={addingMoney} className="flex-1">
                যোগ করুন
              </Button>
            </div>
          </div>
        </Modal>
      </motion.div>
    </DashboardLayout>
  );
}
