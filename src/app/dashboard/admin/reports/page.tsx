'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Users, Video, Wallet, Plus, Download } from 'lucide-react';
import { supabase, FEE_TYPES, getFeeAmount } from '@/lib/supabase';
import { generateReportPDF, generateAbsentPDF } from '@/lib/excel-export';
import { compareBySerialNumber } from '@/lib/sms';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import ReportPeriodFilter, { defaultDayPeriod, isInPeriod, type ReportPeriod } from '@/components/ReportPeriodFilter';
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
  const [dataLoaded, setDataLoaded] = useState(false);
  const [inPersonMoney, setInPersonMoney] = useState(0);
  const [teleconsultMoney, setTeleconsultMoney] = useState(0);
  const [refundedTotal, setRefundedTotal] = useState(0);
  const [addedMoney, setAddedMoney] = useState(0);
  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [addedAmount, setAddedAmount] = useState('');
  const [addingMoney, setAddingMoney] = useState(false);

  const [period, setPeriod] = useState<ReportPeriod>(() => defaultDayPeriod(getLocalDateString()));

  // Cache all data
  const [allApts, setAllApts] = useState<any[]>([]);
  const [allDoctors, setAllDoctors] = useState<any[]>([]);
  const [addedMoneyData, setAddedMoneyData] = useState<any[]>([]);

  // Load all data once
  useEffect(() => {
    loadAllData();
  }, []);

  // Recalculate when the period or data changes (instant, no DB call)
  useEffect(() => {
    if (dataLoaded) {
      calculateStats();
    }
  }, [period, allApts, allDoctors, addedMoneyData, dataLoaded]);

  async function loadAllData() {
    setLoading(true);
    
    const [aptsResult, doctorsResult, moneyResult] = await Promise.all([
      supabase.from('appointments').select('*, doctors(id, name, consultation_fee, specialization), patients(name, phone, age, sex)').order('date', { ascending: false }),
      supabase.from('doctors').select('id, name, consultation_fee').order('name'),
      supabase.from('transactions').select('amount, date').eq('type', 'added')
    ]);

    if (aptsResult.data) setAllApts(aptsResult.data);
    if (doctorsResult.data) setAllDoctors(doctorsResult.data);
    if (moneyResult.data) setAddedMoneyData(moneyResult.data);
    
    setLoading(false);
    setDataLoaded(true);
  }

  function periodApts() {
    return allApts.filter((a: any) => isInPeriod(a.date, period)).sort(compareBySerialNumber);
  }

  function periodDateLabel() {
    return period.start === period.end
      ? period.start.replace(/-/g, '/')
      : `${period.start.replace(/-/g, '/')} - ${period.end.replace(/-/g, '/')}`;
  }

  function mapForReportPDF(apt: any) {
    const serialSuffix = apt.serial_number?.slice(-1) || '';
    const feeTypeMap: Record<string, string> = { N: 'New Patient', F: 'Follow Up', R: 'Report Showing' };
    const feeTypeLabel = feeTypeMap[serialSuffix] || FEE_TYPES.find((f: any) => f.value === apt.fee_type)?.label || apt.fee_type || 'New Patient';
    return {
      serial: apt.serial_number || '-',
      patientName: apt.patients?.name || apt.patientName || '-',
      phone: apt.patients?.phone || '-',
      age: apt.patients?.age || apt.age || '-',
      gender: apt.patients?.sex === 'male' ? 'Male' : apt.patients?.sex === 'female' ? 'Female' : apt.patients?.sex || '-',
      doctor: apt.doctors?.name || apt.doctorName || '-',
      department: apt.doctors?.specialization || 'General',
      type: apt.type === 'teleconsult' ? 'Teleconsult' : 'In-Person',
      status: apt.status === 'confirmed' ? 'Confirmed' : apt.status === 'completed' ? 'Completed' : apt.status === 'pending' ? 'Pending' : apt.status === 'cancelled' ? 'Cancelled' : apt.status || '-',
      time: apt.time || '-',
      date: apt.date || '-',
      feeType: feeTypeLabel,
      advance: apt.advance || 0,
      paid: Math.max(0, (apt.paid || 0) - (apt.refunded || 0)),
      refunded: apt.refunded || 0,
      netPayble: getFeeAmount(apt.fee_type) - (apt.refunded || 0),
      due: (getFeeAmount(apt.fee_type) - (apt.refunded || 0)) - (apt.paid || 0),
    };
  }

  function mapForAbsentPDF(apt: any) {
    const serialSuffix = apt.serial_number?.slice(-1) || '';
    const feeTypeMap: Record<string, string> = { N: 'New Patient', F: 'Follow Up', R: 'Report Showing' };
    const feeTypeLabel = feeTypeMap[serialSuffix] || FEE_TYPES.find((f: any) => f.value === apt.fee_type)?.label || apt.fee_type || 'New Patient';
    return {
      serial: apt.serial_number || '-',
      patientName: apt.patients?.name || apt.patientName || '-',
      phone: apt.patients?.phone || '-',
      age: apt.patients?.age || apt.age || '-',
      gender: apt.patients?.sex === 'male' ? 'Male' : apt.patients?.sex === 'female' ? 'Female' : apt.patients?.sex || '-',
      doctor: apt.doctors?.name || apt.doctorName || '-',
      department: apt.doctors?.specialization || 'General',
      type: apt.type === 'teleconsult' ? 'Teleconsult' : 'In-Person',
      status: apt.status === 'confirmed' ? 'Confirmed' : apt.status === 'completed' ? 'Completed' : apt.status === 'pending' ? 'Pending' : apt.status === 'cancelled' ? 'Cancelled' : apt.status || '-',
      time: apt.time || '-',
      date: apt.date || '-',
      feeType: feeTypeLabel,
      bookedBy: apt.booked_by || '-',
      createdAt: apt.created_at || '',
    };
  }

  function handleExportPDF() {
    // রিপোর্ট পেজের পরিসংখ্যানের সাথে মিল রাখতে শুধু confirmed/completed অ্যাপয়েন্টমেন্ট
    const filtered = periodApts().filter((a: any) => a.status === 'confirmed' || a.status === 'completed');
    if (filtered.length === 0) {
      toast.error('এই সময়সীমায় কোনো অ্যাপয়েন্টমেন্ট নেই');
      return;
    }
    generateReportPDF({
      title: `Micare Health - Report (${period.label})`,
      date: periodDateLabel(),
      appointments: filtered.map(mapForReportPDF),
    });
  }

  function handleExportAbsentPDF() {
    const absent = periodApts().filter((apt: any) => (apt.paid || 0) === 0 && (apt.refunded || 0) === 0);
    if (absent.length === 0) {
      toast.error('এই সময়সীমায় unpaid অ্যাপয়েন্টমেন্ট নেই');
      return;
    }
    generateAbsentPDF({
      title: `Micare Health - Absent Report (${period.label})`,
      date: periodDateLabel(),
      appointments: absent.map(mapForAbsentPDF),
    });
  }

  function calculateStats() {
    const isEarning = (a: any) => a.status === 'confirmed' || a.status === 'completed';
    const inRange = (a: any) => isInPeriod(a.date, period);

    const earning = allApts.filter((a: any) => inRange(a) && isEarning(a));
    const inPerson = earning.filter((a: any) => a.type !== 'teleconsult');
    const tele = earning.filter((a: any) => a.type === 'teleconsult');
    const completedCount = allApts.filter((a: any) => inRange(a) && a.status === 'completed' && a.type !== 'teleconsult');
    const patients = new Set(earning.map((a: any) => a.patient_id)).size;

    // Net collected per appointment — the same value the appointments table
    // shows in its পরিশোধ (Paid) column. A fully refunded appointment
    // contributes 0 here, not its original gross paid amount.
    const calcPaid = (apts: any[]) => apts.reduce(
      (sum: number, a: any) => sum + Math.max(0, (Number(a.paid) || 0) - (Number(a.refunded) || 0)),
      0
    );
    const calcRefunded = (apts: any[]) => apts.reduce((sum: number, a: any) => sum + (Number(a.refunded) || 0), 0);

    setInPersonMoney(calcPaid(inPerson));
    setTeleconsultMoney(calcPaid(tele));
    setRefundedTotal(calcRefunded(allApts.filter(inRange)));
    setAddedMoney(
      addedMoneyData
        .filter((t: any) => isInPeriod(t.date, period))
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)
    );

    setStats([
      { label: 'মোট অ্যাপয়েন্টমেন্ট', value: earning.length },
      { label: 'নিশ্চিতকৃত টেলিকনসাল্ট', value: tele.length },
      { label: 'মোট সম্পন্ন', value: completedCount.length + tele.length },
      { label: 'মোট রোগী', value: patients },
    ]);

    setDoctorStats(allDoctors.map((doc: any) => {
      const filtered = allApts.filter((a: any) => a.doctor_id === doc.id && inRange(a) && isEarning(a));
      return {
        name: doc.name,
        appointments: filtered.length,
        teleconsult: filtered.filter((a: any) => a.type === 'teleconsult' && isEarning(a)).length,
        completed: filtered.filter((a: any) => a.status === 'completed').length,
      };
    }));
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
            <ReportPeriodFilter period={period} onChange={setPeriod} />
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 text-white rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 transition shadow-md text-sm font-medium flex items-center gap-1.5"
              title="নির্বাচিত সময়সীমার রিপোর্ট PDF"
            >
              <Download className="w-4 h-4" /> PDF
            </button>
            <button
              onClick={handleExportAbsentPDF}
              className="px-4 py-2 text-white rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 transition shadow-md text-sm font-medium flex items-center gap-1.5"
              title="যারা পরিশোধ করেনি (Paid 0 / Refund 0)"
            >
              <Download className="w-4 h-4" /> Absent PDF
            </button>
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
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
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
                  <p className="text-emerald-100 text-sm">আয় · {period.label}</p>
                  <p className="text-3xl font-bold">
                    ৳{(inPersonMoney + teleconsultMoney + addedMoney).toLocaleString()}
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
            </div>
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                <span className="text-emerald-100">সম্পন্ন সরাসরি আপয়েন্টমেন্ট</span>
                <span className="font-semibold">৳{inPersonMoney.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                <span className="text-emerald-100">নিশ্চিতকৃত টেলিকনসাল্ট</span>
                <span className="font-semibold">৳{teleconsultMoney.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                <span className="text-emerald-100">যোগ করা টাকা</span>
                <span className="font-semibold">৳{addedMoney.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                <span className="text-emerald-100">রিফান্ড (আলাদা হিসাব)</span>
                <span className="font-semibold text-red-300">৳{refundedTotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between bg-white/20 rounded-lg p-3">
                <span className="text-white font-medium">মোট</span>
                <span className="text-white font-bold">৳{(inPersonMoney + teleconsultMoney + addedMoney).toLocaleString()}</span>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-slate-900 mb-4">ডাক্তার অনুযায়ী ({period.label})</h2>
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
