'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Calendar, Clock, Video, ArrowRight, Star, Loader2, Heart, User, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

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

export default function PatientDashboard() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientName, setPatientName] = useState('');

  useEffect(() => {
    async function loadData() {
      if (typeof window === 'undefined') return;
      
      const patientData = JSON.parse(localStorage.getItem('patientData') || 'null');
      
      if (patientData) {
        setPatientName(patientData.name || 'রোগী');
      }

      // Load doctors from Supabase
      const { data: dbDoctors } = await supabase
        .from('doctors')
        .select('*')
        .eq('is_available', true)
        .limit(4);

      if (dbDoctors) {
        const mapped = dbDoctors.map((d: any) => ({
          ...d,
          specialty: d.specialization || d.specialty || ''
        }));
        setDoctors(mapped);
      }

      // Load appointments for this patient from Supabase
      if (patientData && patientData.id) {
        const { data: apts } = await supabase
          .from('appointments')
          .select('*, doctors(name, specialization)')
          .eq('patient_id', patientData.id)
          .order('date', { ascending: true });

        if (apts) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const upcoming = apts
            .filter(apt => new Date(apt.date) >= today && apt.status !== 'cancelled')
            .slice(0, 3)
            .map(apt => ({
              ...apt,
              doctor: apt.doctors?.name,
              specialization: apt.doctors?.specialization
            }));
          
          setAppointments(upcoming);
        }

        // Check for unread notifications
        if (patientData && patientData.id) {
          const { data: notifs } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', patientData.id)
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(3);
          
          if (notifs && notifs.length > 0) {
            for (const n of notifs) {
              if (n.type === 'appointment' || n.type === 'teleconsult') {
                toast.success(n.message);
              }
            }
            // Mark them as read
            const notifIds = notifs.map((n: any) => n.id);
            await supabase
              .from('notifications')
              .update({ is_read: true })
              .in('id', notifIds);
          }
        }
      }

      setLoading(false);
    }

    loadData();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', weekday: 'short' });
  };

  const quickActions = [
    { label: 'বুক অ্যাপয়েন্টমেন্ট', href: '/dashboard/patient/book', icon: Calendar, color: 'from-sky-500 to-blue-600', desc: 'ডাক্তারের সাথে অ্যাপয়েন্টমেন্ট' },
    { label: 'আমার অ্যাপয়েন্টমেন্ট', href: '/dashboard/patient/appointments', icon: Clock, color: 'from-teal-500 to-emerald-600', desc: 'আপনার সময়সূচী' },
    { label: 'ভিডিও কল', href: '/dashboard/patient/teleconsult', icon: Video, color: 'from-purple-500 to-violet-600', desc: 'টেলিকনসাল্ট' },
    { label: 'সকল ডাক্তার', href: '/dashboard/patient/doctors', icon: User, color: 'from-orange-500 to-amber-600', desc: 'ডাক্তার তালিকা' },
  ];

  if (loading) {
    return (
      <DashboardLayout role="patient">
        <div className="space-y-6">
          <div className="h-24 bg-slate-200 rounded-2xl animate-pulse" />
          <div className="grid grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <CardSkeleton key={i} />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="patient">
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6 page-enter"
      >
        {/* Welcome Hero */}
        <motion.div 
          variants={heroVariants}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-blue-700 p-6 text-white shadow-xl shadow-primary-500/20 animate-gradient"
        >
          <motion.div variants={heroItemVariants} className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-5 h-5 text-primary-200" />
              <span className="text-primary-200 text-sm font-medium">স্বাগতম</span>
            </div>
            <h1 className="text-2xl font-bold mb-1">{patientName}!</h1>
            <p className="text-primary-100 text-sm">আপনার স্বাস্থ্য আমাদের কাছে গুরুত্বপূর্ণ</p>
          </motion.div>
          <motion.div 
            variants={heroItemVariants}
            className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-2xl" 
          />
        </motion.div>

        {/* Quick Actions Grid */}
        <motion.div 
          variants={itemVariants}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {quickActions.map((action, i) => (
            <Link
              key={action.href}
              href={action.href}
            >
              <motion.div
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className={`
                  relative overflow-hidden rounded-2xl p-4 text-white shadow-lg
                  bg-gradient-to-br ${action.color}
                  hover:shadow-xl transition-all duration-300
                `}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                      <action.icon className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="font-semibold text-sm">{action.label}</p>
                  <p className="text-xs text-white/70 mt-1">{action.desc}</p>
              </motion.div>
            </Link>
          ))}
        </motion.div>

        {/* Primary CTA - Book Appointment */}
        <motion.div variants={itemVariants}>
          <Link href="/dashboard/patient/book" className="block group">
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="relative overflow-hidden rounded-2xl bg-white border-2 border-primary-100 p-6 hover:border-primary-200 hover:shadow-xl hover:shadow-primary-500/10 transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white shadow-lg shadow-primary-500/30 group-hover:scale-110 transition-transform">
                    <Calendar className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">অ্যাপয়েন্টমেন্ট বুক করুন</h3>
                    <p className="text-slate-500 text-sm">আপনার সুবিধার জন্য ডাক্তারের সাথে অ্যাপয়েন্টমেন্ট</p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 group-hover:bg-primary-500 group-hover:text-white transition-all">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>
            </motion.div>
          </Link>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming Appointments Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>আসন্ন অ্যাপয়েন্টমেন্ট</CardTitle>
              <Link href="/dashboard/patient/appointments" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                সব দেখুন <ChevronRight className="w-4 h-4" />
              </Link>
            </CardHeader>
            
            {appointments.length > 0 ? (
              <motion.div className="space-y-3">
                {appointments.map((apt, i) => (
                  <motion.div 
                    key={apt.id}
                    variants={itemVariants}
                    whileHover={{ x: 5 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className={`
                      w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-md
                      ${apt.type === 'teleconsult' ? 'bg-gradient-to-br from-purple-500 to-violet-600' : 'bg-gradient-to-br from-sky-500 to-blue-600'}
                    `}>
                      {apt.date?.split('-')[2] || '০১'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{apt.doctor}</p>
                      <p className="text-sm text-slate-500">{formatDate(apt.date)} • {apt.time}</p>
                    </div>
                    <StatusPill status={apt.status} size="sm" />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="text-center py-8">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-7 h-7 text-slate-400" />
                </div>
                <p className="text-slate-500 mb-4">কোনো অ্যাপয়েন্টমেন্ট নেই</p>
                <Link href="/dashboard/patient/book" className="btn-secondary text-sm">
                  অ্যাপয়েন্টমেন্ট বুক করুন
                </Link>
              </div>
            )}
          </Card>

          {/* Available Doctors */}
          <Card>
            <CardHeader>
              <CardTitle>উপলব্ধ ডাক্তার</CardTitle>
              <Link href="/dashboard/patient/doctors" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                সব দেখুন <ChevronRight className="w-4 h-4" />
              </Link>
            </CardHeader>
            
            {doctors.length > 0 ? (
              <motion.div className="space-y-3">
                {doctors.map((doctor, i) => (
                  <motion.div
                    key={doctor.id}
                    variants={itemVariants}
                    whileHover={{ scale: 1.01 }}
                  >
                    <Link 
                      key={doctor.id} 
                      href={`/dashboard/patient/book?doctor=${doctor.id}`}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold shadow-md group-hover:shadow-lg transition-shadow">
                        {doctor.name?.charAt(2) || 'ডা'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{doctor.name}</p>
                        <p className="text-sm text-slate-500">{doctor.specialization}</p>
                      </div>
                      <div className="flex items-center gap-1 text-emerald-600">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                        <span className="text-xs font-medium">উপলব্ধ</span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="text-center py-8">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <User className="w-7 h-7 text-slate-400" />
                </div>
                <p className="text-slate-500">কোনো ডাক্তার নেই</p>
              </div>
            )}
          </Card>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}