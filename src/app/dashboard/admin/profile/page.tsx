'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { User, Shield, Users, Stethoscope, Calendar, Save, X, Eye, EyeOff, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminProfile() {
  const [adminData, setAdminData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [stats, setStats] = useState({ doctors: 0, patients: 0, appointments: 0 });
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    passcode: '',
  });

  const [showPasscode, setShowPasscode] = useState(false);
  const [isChangingPasscode, setIsChangingPasscode] = useState(false);
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('adminData');
    if (stored) {
      const data = JSON.parse(stored);
      setAdminData(data);
      setFormData({
        name: data.name || '',
        email: data.email || '',
        passcode: data.passcode || '',
      });
      loadStats();
    } else {
      setLoading(false);
    }
  }, []);

  async function loadStats() {
    const [{ count: doctors }, { count: patients }, { count: appointments }] = await Promise.all([
      supabase.from('doctors').select('*', { count: 'exact', head: true }),
      supabase.from('patients').select('*', { count: 'exact', head: true }),
      supabase.from('appointments').select('*', { count: 'exact', head: true }),
    ]);

    setStats({
      doctors: doctors || 0,
      patients: patients || 0,
      appointments: appointments || 0,
    });
    setLoading(false);
  }

  async function handleSave() {
    if (!adminData) return;

    const { error } = await supabase
      .from('admins')
      .update({
        name: formData.name,
        email: formData.email,
      })
      .eq('id', adminData.id);

    if (error) {
      toast.error('আপডেট ব্যর্থ');
    } else {
      const updated = { ...adminData, ...formData };
      localStorage.setItem('adminData', JSON.stringify(updated));
      setAdminData(updated);
      toast.success('প্রোফাইল আপডেট হয়েছে');
      setEditing(false);
    }
  }

  async function handleChangePasscode() {
    const trimmedNew = newPasscode.trim();
    const trimmedConfirm = confirmPasscode.trim();

    if (!trimmedNew || !trimmedConfirm) {
      toast.error('অনুগ্রহ করে পাসকোড লিখুন');
      return;
    }

    if (trimmedNew !== trimmedConfirm) {
      toast.error('পাসকোড মিলছে না');
      return;
    }

    const { error } = await supabase
      .from('admins')
      .update({ passcode: trimmedNew })
      .eq('id', adminData.id);

    if (error) {
      toast.error('পাসকোড আপডেট ব্যর্থ');
    } else {
      const updated = { ...adminData, passcode: trimmedNew };
      localStorage.setItem('adminData', JSON.stringify(updated));
      setAdminData(updated);
      setFormData({ ...formData, passcode: trimmedNew });
      toast.success('পাসকোড সফলভাবে পরিবর্তন করা হয়েছে');
      setIsChangingPasscode(false);
      setNewPasscode('');
      setConfirmPasscode('');
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">প্রোফাইল</h1>

        {/* Profile Card */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-3xl font-bold">
                {formData.name?.[0]?.toUpperCase() || 'A'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{formData.name || 'অ্যাডমিন'}</h2>
                <p className="text-slate-500">{adminData?.email}</p>
                <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full mt-1">
                  <Shield className="w-3 h-3" /> অ্যাডমিন
                </span>
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

          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">নাম</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input pl-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">ইমেইল</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input pl-11"
                  />
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* System Overview */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">সিস্টেম ওভারভিউ</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50 rounded-xl text-center">
              <Stethoscope className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-emerald-700">{stats.doctors}</p>
              <p className="text-sm text-emerald-600">মোট ডাক্তার</p>
            </div>
            <div className="p-4 bg-sky-50 rounded-xl text-center">
              <Users className="w-8 h-8 text-sky-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-sky-700">{stats.patients}</p>
              <p className="text-sm text-sky-600">মোট রোগী</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl text-center">
              <Calendar className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-purple-700">{stats.appointments}</p>
              <p className="text-sm text-purple-600">মোট অ্যাপয়েন্টমেন্ট</p>
            </div>
          </div>
        </Card>

        {/* Security Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-slate-600" /> সিকিউরিটি
            </h3>
            {!isChangingPasscode && (
              <Button variant="secondary" onClick={() => setIsChangingPasscode(true)}>
                পাসকোড পরিবর্তন করুন
              </Button>
            )}
          </div>

          {!isChangingPasscode ? (
            <div className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPasscode ? 'text' : 'password'}
                  value={formData.passcode}
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
              <p className="text-xs text-slate-500">এটি আপনার প্রশাসনিক লগইন পাসকোড।</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">নতুন পাসকোড</label>
                <input
                  type="text"
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value)}
                  className="input"
                  placeholder="নতুন পাসকোড লিখুন"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">পুনরায় নিশ্চিত করুন</label>
                <input
                  type="text"
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  className="input"
                  placeholder="আবার পাসকোড লিখুন"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" onClick={() => setIsChangingPasscode(false)}>
                  বাতিল
                </Button>
                <Button onClick={handleChangePasscode}>
                  সেভ করুন
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
