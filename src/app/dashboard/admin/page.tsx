'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Calendar, Users, Video, CheckCircle, Plus, Clock, ArrowRight, TrendingUp, Activity, Wallet, Scan, FileText } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatCardSkeleton } from '@/components/ui/Skeleton';
import { BarcodeScannerInput } from '@/components/ui/BarcodeScannerInput';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';

interface Stat {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  trend?: string;
  subValues?: {
    total: number;
    appointment: number;
    teleconsult: number;
  };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannedPatient, setScannedPatient] = useState<any>(null);
  const router = useRouter();

  const handleBarcodePatient = useCallback((patient: any) => {
    setScannedPatient(patient);
    toast.success(`${patient.name} পাওয়া গেছে`);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const getLocalDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  async function loadDashboardData() {
    const todayStr = getLocalDateString();
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const firstDayStr = `${firstDayOfMonth.getFullYear()}-${String(firstDayOfMonth.getMonth() + 1).padStart(2, '0')}-${String(firstDayOfMonth.getDate()).padStart(2, '0')}`;

    const { data: supabaseApts, error: aptError } = await supabase
      .from('appointments')
      .select('*, doctors(name, specialization, consultation_fee), patients(name)')
      .order('created_at', { ascending: false })
      .limit(50);

    const todayApts = (supabaseApts || []).filter((apt: any) => {
      const aptDate = apt.date || '';
      return aptDate.toString().split('T')[0] === todayStr;
    });

    const monthApts = (supabaseApts || []).filter((apt: any) => {
      const aptDate = apt.date || '';
      return aptDate.toString().split('T')[0] >= firstDayStr && apt.status === 'confirmed';
    });

    const patientIds = new Set<string>();
    todayApts.forEach((a: any) => {
      if (a.patient_id) patientIds.add(a.patient_id);
    });

    const pendingTotal = todayApts.filter((a: any) => a.status === 'pending').length || 0;
    const pendingApt = todayApts.filter((a: any) => a.status === 'pending' && a.type !== 'teleconsult').length || 0;
    const pendingTele = todayApts.filter((a: any) => a.status === 'pending' && a.type === 'teleconsult').length || 0;
    
    const confirmedTotal = todayApts.filter((a: any) => a.status === 'confirmed').length || 0;
    const confirmedApt = todayApts.filter((a: any) => a.status === 'confirmed' && a.type !== 'teleconsult').length || 0;
    const confirmedTele = todayApts.filter((a: any) => a.status === 'confirmed' && a.type === 'teleconsult').length || 0;

    const completedTotal = todayApts.filter((a: any) => a.status === 'completed').length || 0;
    const completedApt = todayApts.filter((a: any) => a.status === 'completed' && a.type !== 'teleconsult').length || 0;
    const completedTele = todayApts.filter((a: any) => a.status === 'completed' && a.type === 'teleconsult').length || 0;

    const statsData: Stat[] = [
      {
        label: 'অপেক্ষায়',
        value: pendingTotal,
        icon: Clock,
        color: 'text-amber-600',
        bgColor: 'bg-amber-100',
        subValues: { total: pendingTotal, appointment: pendingApt, teleconsult: pendingTele }
      },
      {
        label: 'নিশ্চিত',
        value: confirmedTotal,
        icon: Calendar,
        color: 'text-primary-600',
        bgColor: 'bg-primary-100',
        subValues: { total: confirmedTotal, appointment: confirmedApt, teleconsult: confirmedTele }
      },
      {
        label: 'সম্পন্ন',
        value: completedTotal,
        icon: CheckCircle,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-100',
        subValues: { total: completedTotal, appointment: completedApt, teleconsult: completedTele }
      },
      {
        label: 'বাকি',
        value: confirmedTotal,
        icon: Video,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
        subValues: { total: confirmedTotal, appointment: confirmedApt, teleconsult: confirmedTele }
      },
    ];
    setStats(statsData);

    // Today's schedule grouped by doctor
    if (todayApts.length) {
      const grouped: any = {};
      todayApts.forEach((apt: any) => {
        const doc = apt.doctors?.name || 'Unknown';
        if (!grouped[doc]) grouped[doc] = { doctor: doc, patients: 0, specialization: apt.doctors?.specialization };
        grouped[doc].patients++;
      });
      setTodaySchedule(Object.values(grouped));
    }

    // Recent appointments
    const recent = (supabaseApts || []).slice(0, 5).map((a: any) => ({
      id: a.id,
      patient: a.patients?.name || 'রোগী',
      time: a.time,
      doctor: a.doctors?.name || 'ডাক্তার',
      type: a.type,
      status: a.status
    }));
    if (recent.length) setRecentAppointments(recent);

    setLoading(false);
  }

  const quickActions = [
    { label: 'শিফট যোগ', action: () => { localStorage.setItem('openShiftModal', 'true'); router.push('/dashboard/admin/schedule'); }, icon: Clock, color: 'from-sky-500 to-sky-600' },
    { label: 'ওয়াক-ইন', action: () => { localStorage.setItem('openAppointmentModal', 'true'); router.push('/dashboard/admin/appointments'); }, icon: Users, color: 'from-teal-500 to-teal-600' },
    { label: 'ডাক্তার তালিকা', action: () => router.push('/dashboard/admin/doctors'), icon: Activity, color: 'from-purple-500 to-purple-600' },
  ];

  const handleQuickAction = (action: () => void) => {
    action();
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
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
    <DashboardLayout role="admin">
      <div className="space-y-6 page-enter">
        {/* Welcome Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-blue-700 p-6 text-white shadow-xl shadow-primary-500/20 animate-gradient">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-primary-200" />
              <span className="text-primary-200 text-sm font-medium">অ্যাডমিন প্যানেল</span>
            </div>
            <h1 className="text-2xl font-bold mb-1">স্বাগতম, অ্যাডমিন!</h1>
            <p className="text-primary-100 text-sm">আজকের ক্লিনিক পরিসংখ্যান এবং কার্যক্রম</p>
          </div>
          <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-pulse" />
          <div className="absolute -right-8 top-10 w-24 h-24 bg-white/5 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-3 gap-4">
          {quickActions.map((item, i) => (
            <button
              key={item.label}
              onClick={() => handleQuickAction(item.action)}
              className="group animate-fade-up flex flex-col items-center justify-center p-4 rounded-2xl text-white shadow-lg bg-gradient-to-br hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              style={{ 
                animationDelay: `${i * 50}ms`,
                background: i === 0 ? 'linear-gradient(135deg, #0ea5e9, #0284c7)' : 
                            i === 1 ? 'linear-gradient(135deg, #14b8a6, #0d9488)' : 
                            'linear-gradient(135deg, #a855f7, #9333ea)'
              }}
            >
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm mb-2">
                <item.icon className="w-6 h-6" />
              </div>
              <p className="font-semibold text-sm text-center">{item.label}</p>
            </button>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="card group animate-fade-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                {stat.trend && (
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                    {stat.trend}
                  </span>
                )}
              </div>
              <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
              {stat.subValues && (
                <div className="flex gap-3 mt-2 text-xs">
                  <span className="text-slate-400">অ্যাপ: {stat.subValues.appointment}</span>
                  <span className="text-slate-400">টেলি: {stat.subValues.teleconsult}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        

        {/* Barcode Scanner Card */}
        <Card className="bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200/60">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary-100">
                <Scan className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">বারকোড স্ক্যানার</h3>
                <p className="text-sm text-slate-500">রোগীর বারকোড স্ক্যান করে তথ্য দেখুন</p>
              </div>
            </div>
            <div className="flex-1 w-full sm:max-w-sm">
              <BarcodeScannerInput
                onPatientFound={handleBarcodePatient}
                placeholder="বারকোড স্ক্যান করুন..."
                autoFocus={false}
              />
            </div>
          </div>

          {scannedPatient && (
            <div className="mt-4 pt-4 border-t border-primary-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{scannedPatient.name}</p>
                  <p className="text-sm text-slate-500">
                    {scannedPatient.phone && `${scannedPatient.phone}`}
                    {scannedPatient.age && ` | বয়স: ${scannedPatient.age}`}
                    {scannedPatient.bcode && ` | কোড: ${scannedPatient.bcode}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      localStorage.setItem('openAppointmentModal', 'true');
                      router.push('/dashboard/admin/appointments');
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" /> অ্যাপয়েন্টমেন্ট
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      window.open(`https://carescriptrx.vercel.app/dashboard/doctor/prescribe?patient_id=${scannedPatient.id}`, '_blank');
                    }}
                  >
                    <FileText className="w-4 h-4 mr-1" /> প্রেসক্রিব
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Today's Clinic Flow - Timeline */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>আজকের ক্লিনিক ফ্লো</CardTitle>
                <Link href="/dashboard/admin/schedule" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                  সব দেখুন <ArrowRight className="w-4 h-4" />
                </Link>
              </CardHeader>
              
              {todaySchedule.length > 0 ? (
                <div className="space-y-3">
                  {todaySchedule.map((s, i) => (
                    <div 
                      key={i} 
                      className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold shadow-md">
                        {s.doctor?.charAt(2) || 'ডা'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{s.doctor}</p>
                        <p className="text-sm text-slate-500">{s.specialization}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary-600">{s.patients}</p>
                        <p className="text-xs text-slate-500">জন রোগী</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-500">আজকের কোনো অ্যাপয়েন্টমেন্ট নেই</p>
                </div>
              )}
            </Card>
          </div>

          {/* Recent Appointments Mini */}
          <div className="space-y-4">
            <Card>
              <CardTitle className="mb-4">সাম্প্রতিক অ্যাপয়েন্টমেন্ট</CardTitle>
              <div className="space-y-3">
                {recentAppointments.length > 0 ? recentAppointments.slice(0, 3).map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{a.patient}</p>
                      <p className="text-xs text-slate-500">{a.doctor}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-700">{a.time}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        a.type === 'teleconsult' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'
                      }`}>
                        {a.type === 'teleconsult' ? 'ভিডিও' : 'সরাসরি'}
                      </span>
                    </div>
                  </div>
                )) : (
                  <p className="text-center text-slate-400 py-4">কোনো অ্যাপয়েন্টমেন্ট নেই</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}