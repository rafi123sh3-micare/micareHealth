'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Calendar, Clock, Video, CheckCircle, Play, ArrowRight, Activity } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { setCache, getCache } from '@/lib/cache';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { StatCardSkeleton } from '@/components/ui/Skeleton';
import { motion } from 'framer-motion';

const days = [
  { index: 0, name: 'রবিবার' },
  { index: 1, name: 'সোমবার' },
  { index: 2, name: 'মঙ্গলবার' },
  { index: 3, name: 'বুধবার' },
  { index: 4, name: 'বৃহস্পতিবার' },
  { index: 5, name: 'শুক্রবার' },
  { index: 6, name: 'শনিবার' },
];

interface Stat {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  subValues?: { total: number; appointment: number; teleconsult: number };
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15
    }
  }
};

const heroVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.8,
      staggerChildren: 0.12,
      delayChildren: 0.2
    }
  }
};

const heroItemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15
    }
  }
};

export default function DoctorDashboard() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [teleconsultPending, setTeleconsultPending] = useState<number>(0);
  const [appointmentPending, setAppointmentPending] = useState<number>(0);
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [todayShifts, setTodayShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingSchedules, setPendingSchedules] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }
    const doctorData = JSON.parse(localStorage.getItem('doctorData') || 'null');
    
    if (!doctorData) {
      setLoading(false);
      return;
    }

    // Try cache first
    const cachedStats = getCache<any[]>('doctor_stats');
    const cachedSchedule = getCache<any[]>('doctor_schedule');
    if (cachedStats) setStats(cachedStats);
    if (cachedSchedule) setTodaySchedule(cachedSchedule);

    const { data: pendingSchedulesData } = await supabase
      .from('schedules')
      .select('*')
      .eq('doctor_id', doctorData.id)
      .eq('status', 'pending')
      .order('date', { ascending: true });

    if (pendingSchedulesData) {
      setPendingSchedules(pendingSchedulesData);
    }

    const getLocalDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString();

    // Only fetch today's appointments with date filter in query
    const { data: supabaseApts } = await supabase
      .from('appointments')
      .select('*, patients(name)')
      .eq('doctor_id', doctorData.id)
      .eq('date', todayStr)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })
      .limit(50);

    const todayApts = supabaseApts || [];
    
    const pendingTotal = todayApts.filter((a: any) => a.status === 'pending').length || 0;
    const pendingApt = todayApts.filter((a: any) => a.status === 'pending' && a.type !== 'teleconsult').length || 0;
    const pendingTele = todayApts.filter((a: any) => a.status === 'pending' && a.type === 'teleconsult').length || 0;
    
    const confirmedTotal = todayApts.filter((a: any) => a.status === 'confirmed').length || 0;
    const confirmedApt = todayApts.filter((a: any) => a.status === 'confirmed' && a.type !== 'teleconsult').length || 0;
    const confirmedTele = todayApts.filter((a: any) => a.status === 'confirmed' && a.type === 'teleconsult').length || 0;
    
    const completedTotal = todayApts.filter((a: any) => a.status === 'completed').length || 0;
    const completedApt = todayApts.filter((a: any) => a.status === 'completed' && a.type !== 'teleconsult').length || 0;
    const completedTele = todayApts.filter((a: any) => a.status === 'completed' && a.type === 'teleconsult').length || 0;
    
    const remaining = confirmedTotal;

    setStats([
      { label: 'অপেক্ষায়', value: pendingTotal.toString(), icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-100', subValues: { total: pendingTotal, appointment: pendingApt, teleconsult: pendingTele } },
      { label: 'নিশ্চিত', value: confirmedTotal.toString(), icon: Calendar, color: 'text-primary-600', bgColor: 'bg-primary-100', subValues: { total: confirmedTotal, appointment: confirmedApt, teleconsult: confirmedTele } },
      { label: 'সম্পন্ন', value: completedTotal.toString(), icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-100', subValues: { total: completedTotal, appointment: completedApt, teleconsult: completedTele } },
      { label: 'বাকি', value: String(remaining), icon: Video, color: 'text-purple-600', bgColor: 'bg-purple-100', subValues: { total: remaining, appointment: confirmedApt, teleconsult: confirmedTele } },
    ]);

    if (todayApts.length > 0) {
      const mapped = todayApts.map((apt: any) => ({
        id: apt.id,
        time: apt.time,
        patient: apt.patients?.name || 'রোগী',
        type: apt.type,
        status: apt.status,
        serial_number: apt.serial_number || null
      }));
      setTodaySchedule(mapped);
      setCache('doctor_schedule', mapped);
    }

    // Cache stats
    setCache('doctor_stats', [
      { label: 'অপেক্ষায়', value: pendingTotal.toString(), icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-100', subValues: { total: pendingTotal, appointment: pendingApt, teleconsult: pendingTele } },
      { label: 'নিশ্চিত', value: confirmedTotal.toString(), icon: Calendar, color: 'text-primary-600', bgColor: 'bg-primary-100', subValues: { total: confirmedTotal, appointment: confirmedApt, teleconsult: confirmedTele } },
      { label: 'সম্পন্ন', value: completedTotal.toString(), icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-100', subValues: { total: completedTotal, appointment: completedApt, teleconsult: completedTele } },
      { label: 'বাকি', value: String(remaining), icon: Video, color: 'text-purple-600', bgColor: 'bg-purple-100', subValues: { total: remaining, appointment: confirmedApt, teleconsult: confirmedTele } },
    ]);

    const todayDayOfWeek = new Date().getDay();
    
    const { data: todayShiftsData } = await supabase
      .from('schedules')
      .select('*')
      .eq('doctor_id', doctorData.id)
      .eq('date', todayStr)
      .eq('status', 'active');

    if (todayShiftsData) {
      const todayShiftsFiltered = todayShiftsData.map((s: any) => ({
        id: s.id,
        start_time: s.start_time?.substring(0, 5),
        end_time: s.end_time?.substring(0, 5),
      }));
      setTodayShifts(todayShiftsFiltered);
    }

    setLoading(false);
  }

  const handleScheduleAction = async (id: string, status: 'active' | 'rejected') => {
    const { error } = await supabase
      .from('schedules')
      .update({ status })
      .eq('id', id);
    
    if (!error) {
      toast.success(status === 'active' ? 'শিফট গ্রহণ করা হয়েছে!' : 'শিফট বাতিল করা হয়েছে');
      setPendingSchedules(pendingSchedules.filter((s: any) => s.id !== id));
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="doctor">
        <div className="space-y-6">
          <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <StatCardSkeleton key={i} />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="doctor">
      <motion.div 
        className="space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Welcome Hero */}
        <motion.div 
          variants={heroVariants}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 p-6 text-white shadow-xl shadow-emerald-500/20"
        >
          <motion.div variants={heroItemVariants} className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-emerald-200" />
              <span className="text-emerald-200 text-sm font-medium">ডাক্তার প্যানেল</span>
            </div>
            <h1 className="text-2xl font-bold mb-1">আজকের দিন</h1>
            <p className="text-emerald-100 text-sm">আপনার আজকের কার্যক্রম এবং সময়সূচী</p>
          </motion.div>
          <motion.div 
            variants={heroItemVariants}
            className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-2xl" 
          />
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3">
          {[
            { href: '/dashboard/doctor/schedule', icon: Clock, label: 'আমার শিফট', color: 'from-sky-500 to-blue-600' },
            { href: '/dashboard/doctor/appointments', icon: Calendar, label: 'অ্যাপয়েন্টমেন্ট', color: 'from-purple-500 to-violet-600' },
            { href: '/dashboard/doctor/teleconsult', icon: Video, label: 'ভিডিও কল', color: 'from-cyan-500 to-teal-600' }
          ].map((action, i) => (
            <Link key={action.href} href={action.href}>
              <motion.div 
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className={`relative overflow-hidden rounded-2xl p-4 text-white shadow-lg bg-gradient-to-br ${action.color}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                    <action.icon className="w-5 h-5" />
                  </div>
                </div>
                <p className="font-semibold text-sm">{action.label}</p>
              </motion.div>
            </Link>
          ))}
        </motion.div>

        {/* Stats Row */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div 
              key={stat.label}
              variants={itemVariants}
              whileHover={{ scale: 1.02, y: -2 }}
              className="card"
            >
              <div className={`p-3 rounded-xl ${stat.bgColor} mb-3`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <motion.p 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 + i * 0.1, type: "spring" }}
                className="text-3xl font-bold text-slate-900"
              >
                {stat.value}
              </motion.p>
              <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
              {stat.subValues && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex items-center gap-3 mt-2 text-xs">
                  <span className="flex items-center gap-1 text-amber-600 font-medium">{stat.subValues.total}</span>
                  <span className="flex items-center gap-1 text-primary-600"><Calendar className="w-3 h-3" />{stat.subValues.appointment}</span>
                  <span className="flex items-center gap-1 text-purple-600"><Video className="w-3 h-3" />{stat.subValues.teleconsult}</span>
                </motion.div>
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* Pending Shifts Alert */}
        {pendingSchedules.length > 0 && (
          <motion.div variants={itemVariants} className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-amber-800">অপেক্ষায় শিফট ({pendingSchedules.length})</h3>
            </div>
            <div className="space-y-2">
              {pendingSchedules.slice(0, 3).map((schedule: any) => {
                const dayIndex = new Date(schedule.date).getDay();
                const dayName = days[dayIndex]?.name || schedule.date;
                return (
                <div key={schedule.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-amber-200">
                  <div>
                    <p className="font-medium text-slate-900">{dayName}</p>
                    <p className="text-sm text-slate-500">{schedule.start_time?.substring(0, 5)} - {schedule.end_time?.substring(0, 5)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleScheduleAction(schedule.id, 'active')}
                      className="px-3 py-1.5 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600"
                    >
                      নিশ্চিত
                    </button>
                    <button
                      onClick={() => handleScheduleAction(schedule.id, 'rejected')}
                      className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600"
                    >
                      বাতিল
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Main Content Grid */}
        <motion.div variants={itemVariants} className="grid lg:grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>আজকের অ্যাপয়েন্টমেন্ট</CardTitle>
              <Link href="/dashboard/doctor/appointments" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                সব দেখুন <ArrowRight className="w-4 h-4" />
              </Link>
            </CardHeader>
            {todaySchedule.length > 0 ? (
              <motion.div variants={containerVariants} className="space-y-3">
                {todaySchedule.map((apt, i) => (
                  <motion.div key={i} variants={itemVariants} whileHover={{ x: 5 }} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${apt.status === 'confirmed' ? 'bg-primary-50 border-primary-200' : apt.status === 'completed' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'}`}>
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 shrink-0">
                      {apt.serial_number || i + 1}
                    </div>
                    <motion.div whileHover={{ scale: 1.1 }} className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-md ${apt.status === 'confirmed' ? 'bg-gradient-to-br from-primary-500 to-primary-600' : apt.status === 'completed' ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 'bg-gradient-to-br from-slate-400 to-slate-500'}`}>
                      {apt.time}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{apt.patient}</p>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        {apt.type === 'teleconsult' && <Video className="w-3.5 h-3.5" />}
                        {apt.type === 'teleconsult' ? 'ভিডিও কল' : 'সরাসরি'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {apt.status === 'pending' && <StatusPill status="pending" size="sm" />}
                      {apt.status === 'confirmed' && apt.type === 'teleconsult' && (
                        <Link href="/dashboard/doctor/teleconsult">
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn-primary text-sm py-2 px-3">
                            <Play className="w-4 h-4" /> শুরু
                          </motion.button>
                        </Link>
                      )}
                      {apt.status === 'completed' && <motion.div whileHover={{ scale: 1.1 }}><CheckCircle className="w-5 h-5 text-emerald-500" /></motion.div>}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-7 h-7 text-slate-400" />
                </div>
                <p className="text-slate-500">আজ কোনো অ্যাপয়েন্টমেন্ট নেই</p>
              </motion.div>
            )}
          </Card>
        </motion.div>

        {pendingSchedules.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card className="border-l-4 border-l-amber-400">
              <div className="flex items-center gap-2 mb-4">
                <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                  <Clock className="w-5 h-5 text-amber-500" />
                </motion.div>
                <CardTitle>অপেক্ষায় থাকা শিফট</CardTitle>
              </div>
              <div className="space-y-3">
                {pendingSchedules.map((schedule: any) => {
                  const dayIndex = new Date(schedule.date).getDay();
                  const dayName = days[dayIndex]?.name || schedule.date;
                  return (
                  <motion.div key={schedule.id} variants={itemVariants} whileHover={{ scale: 1.01 }} className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <div>
                      <p className="font-semibold text-slate-900">{dayName}</p>
                      <p className="text-sm text-slate-600">{schedule.start_time?.substring(0, 5)} - {schedule.end_time?.substring(0, 5)}</p>
                      {schedule.is_repeating && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full mt-1 inline-block">সাপ্তাহিক পুনরাবৃত্তি</span>}
                    </div>
                    <div className="flex gap-2">
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleScheduleAction(schedule.id, 'active')} className="px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-xl hover:bg-emerald-600 shadow-md shadow-emerald-500/20">গ্রহণ</motion.button>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleScheduleAction(schedule.id, 'rejected')} className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-300">বাতিল</motion.button>
                    </div>
                  </motion.div>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}