'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { User, Phone, Mail, Award, DollarSign, Calendar, Save, X, Eye, EyeOff, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DoctorProfile() {
  const [doctorData, setDoctorData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    specialization: '',
    degree: '',
    designation: '',
    consultation_fee: '',
  });
  const [showPasscode, setShowPasscode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('doctorData');
    if (stored) {
      const data = JSON.parse(stored);
      setDoctorData(data);
      setFormData({
        name: data.name || '',
        phone: data.phone || '',
        specialization: data.specialization || '',
        degree: data.degree || '',
        designation: data.designation || '',
        consultation_fee: data.consultation_fee?.toString() || '',
      });
      loadAppointments(data.id);
    } else {
      setLoading(false);
    }
  }, []);

  async function loadAppointments(doctorId: string) {
    const getLocalDateString = () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const today = getLocalDateString();
    
    const { data } = await supabase
      .from('appointments')
      .select('*, patients(name, phone)')
      .eq('doctor_id', doctorId)
      .gte('date', today)
      .in('status', ['pending', 'confirmed'])
      .order('date', { ascending: true })
      .limit(10);

    if (data) setAppointments(data);
    setLoading(false);
  }

  async function handleSave() {
    if (!doctorData) return;

    const { error } = await supabase
      .from('doctors')
      .update({
        name: formData.name,
        phone: formData.phone,
        specialization: formData.specialization,
        degree: formData.degree,
        designation: formData.designation,
      })
      .eq('id', doctorData.id);

    if (error) {
      toast.error('আপডেট ব্যর্থ');
    } else {
      const updated = { ...doctorData, ...formData };
      localStorage.setItem('doctorData', JSON.stringify(updated));
      setDoctorData(updated);
      toast.success('প্রোফাইল আপডেট হয়েছে');
      setEditing(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="doctor">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="doctor">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">প্রোফাইল</h1>

        {/* Profile Card */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-3xl font-bold">
                {formData.name?.[0]?.toUpperCase() || 'D'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{formData.name || 'ডাক্তার'}</h2>
                <p className="text-slate-500">{doctorData?.email}</p>
                <p className="text-sm text-primary-600 font-medium">{formData.specialization}</p>
              </div>
            </div>
            {!editing ? (
              <Button onClick={() => setEditing(true)}>সম্পাদনা</Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditing(false)}>
                  <X className="w-4 h-4" /> বাতিল
                </Button>
                <Button onClick={handleSave}>
                  <Save className="w-4 h-4" /> সেভ
                </Button>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">নাম</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!editing}
                  className="input pl-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">ফোন নম্বর</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!editing}
                  className="input pl-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">স্পেশালাইজেশন</label>
              <div className="relative">
                <Award className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  disabled={!editing}
                  className="input pl-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">ডিগ্রি</label>
              <div className="relative">
                <Award className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={formData.degree}
                  onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                  disabled={!editing}
                  className="input pl-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">পদবি (Designation)</label>
              <div className="relative">
                <Award className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  disabled={!editing}
                  placeholder="যেমন: Chief Consultant (Orthopedics & Sports Medicine)"
                  className="input pl-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">কনসাল্টেশন ফি</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="number"
                  value={formData.consultation_fee}
                  disabled
                  className="input pl-11 bg-slate-100"
                />
              </div>
              <p className="text-xs text-slate-400">কনসাল্টেশন ফি পরিবর্তন করতে অ্যাডমিনের সাথে যোগাযোগ করুন</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">ইমেইল</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={doctorData?.email || ''}
                  disabled
                  className="input pl-11 bg-slate-100"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Security Card */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-slate-600" /> সিকিউরিটি
          </h3>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type={showPasscode ? 'text' : 'password'}
              value={doctorData?.passcode || ''}
              readOnly
              className="input pl-11 w-full"
              placeholder="পাসকোড"
            />
            <button
              onClick={() => setShowPasscode(!showPasscode)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPasscode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">এটি আপনার লগইন পাসকোড।</p>
        </Card>

        {/* Upcoming Appointments */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">আসন্ন অ্যাপয়েন্টমেন্ট</h3>
          {appointments.length === 0 ? (
            <p className="text-slate-500 text-center py-4">কোনো অ্যাপয়েন্টমেন্ট নেই</p>
          ) : (
            <div className="space-y-3">
              {appointments.map((apt) => (
                <div key={apt.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">{apt.patients?.name}</p>
                    <p className="text-sm text-slate-500">{apt.patients?.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">{apt.date}</p>
                    <p className="text-xs text-slate-400">{apt.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
