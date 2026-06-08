'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Plus, Search, Phone, X, Check, Copy, Trash2, Calendar, Mail, Stethoscope } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase, getDoctors, generateNextDoctorCode } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { StatusPill } from '@/components/ui/StatusPill';
import DatePicker from '@/components/ui/DatePicker';

function generatePasscode(): string {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

const days = [
  { day: 0, label: 'রবি' },
  { day: 1, label: 'সোম' },
  { day: 2, label: 'মঙ্গল' },
  { day: 3, label: 'বুধ' },
  { day: 4, label: 'বৃহঃ' },
  { day: 5, label: 'শুক্র' },
  { day: 6, label: 'শনি' },
];

export default function AdminDoctors() {
  const [search, setSearch] = useState('');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteDoctor, setDeleteDoctor] = useState<any>(null);
  const [scheduleDoctor, setScheduleDoctor] = useState<any>(null);
  
  const [adminPasscode, setAdminPasscode] = useState('');
  const [doctorPasscode, setDoctorPasscode] = useState('');
  
  const [newDoctor, setNewDoctor] = useState({
    name: '',
    email: '',
    specialty: '',
    phone: '',
    degree: '',
    fee: 500,
    experience: '',
    zoom_link: ''
  });
  const [saving, setSaving] = useState(false);
  const [showPasscode, setShowPasscode] = useState<string | null>(null);
  
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleStartTime, setScheduleStartTime] = useState('');
  const [scheduleEndTime, setScheduleEndTime] = useState('');
  const [isRepeating, setIsRepeating] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);

  useEffect(() => {
    loadDoctors();
    
    if (localStorage.getItem('openDoctorModal') === 'true') {
      localStorage.removeItem('openDoctorModal');
      setTimeout(() => setShowAddModal(true), 500);
    }
  }, []);

  async function loadDoctors() {
    const dbDoctors = await getDoctors();
    if (dbDoctors && dbDoctors.length > 0) {
      setDoctors(dbDoctors);
    }
    setLoading(false);
  }

  const filteredDoctors = doctors.filter(d => 
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.specialization?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddDoctor = async () => {
    if (!newDoctor.name || !newDoctor.specialty || !newDoctor.phone || !newDoctor.email) {
      toast.error('সব তথ্য পূরণ করুন');
      return;
    }

    setSaving(true);
    const passcode = generatePasscode();
    const doctorCode = await generateNextDoctorCode();

    const { data, error } = await supabase.from('doctors').insert([{
      name: newDoctor.name,
      email: newDoctor.email,
      specialization: newDoctor.specialty,
      degree: newDoctor.degree,
      phone: newDoctor.phone,
      consultation_fee: newDoctor.fee,
      experience: newDoctor.experience || '০ বছর',
      rating: 4.5,
      review_count: 0,
      is_available: true,
      passcode: passcode,
      doctor_code: doctorCode,
      zoom_link: newDoctor.zoom_link || null,
    }]).select().single();

    if (error) {
      toast.error('ডাক্তার যোগ করতে ব্যর্থ: ' + error.message);
    } else {
      toast.success('ডাক্তার যোগ হয়েছে!');
      setShowPasscode(passcode);
      loadDoctors();
    }
    
    setSaving(false);
  };

  const copyPasscode = (code: string) => {
    try {
      navigator.clipboard.writeText(code);
    } catch (e) {}
    toast.success('পাসকোড কপি হয়েছে!');
  };

  const handleDeleteDoctor = async () => {
    if (!deleteDoctor) return;
    const storedAdmin = localStorage.getItem('adminData');
    const adminPasscodeFromDB = storedAdmin ? JSON.parse(storedAdmin).passcode : null;
    if (adminPasscode.trim() !== adminPasscodeFromDB) {
      toast.error('অ্যাডমিন পাসকোড ভুল');
      return;
    }
    if (doctorPasscode.trim() !== deleteDoctor.passcode) {
      toast.error('ডাক্তারের পাসকোড ভুল');
      return;
    }

    const { error } = await supabase.from('doctors').delete().eq('id', deleteDoctor.id);
    
    if (error) {
      toast.error('মুছতে ব্যর্থ: ' + error.message);
    } else {
      toast.success('ডাক্তার মুছে ফেলা হয়েছে');
      setDeleteDoctor(null);
      setAdminPasscode('');
      setDoctorPasscode('');
      loadDoctors();
    }
  };

  const handleAddSchedule = async () => {
    if (!scheduleDate || !scheduleStartTime || !scheduleEndTime) {
      toast.error('সব তথ্য পূরণ করুন');
      return;
    }

    const { error } = await supabase.from('schedules').insert({
      doctor_id: scheduleDoctor.id,
      date: scheduleDate,
      start_time: scheduleStartTime,
      end_time: scheduleEndTime,
      status: 'pending',
      is_repeating: isRepeating,
      repeat_days: isRepeating ? repeatDays : null,
    });

    if (error) {
      toast.error('শিফট যোগ করতে ব্যর্থ: ' + error.message);
    } else {
      toast.success('শিফট যোগ হয়েছে! (অপেক্ষায়)');
      setScheduleDoctor(null);
      setScheduleDate('');
      setScheduleStartTime('');
      setScheduleEndTime('');
      setIsRepeating(false);
      setRepeatDays([]);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 page-enter">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">ডাক্তার তালিকা</h1>
            <p className="text-slate-500 mt-1">ক্লিনিকের সকল ডাক্তার</p>
          </div>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-5 h-5" />
            নতুন ডাক্তার
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="ডাক্তার খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-14"
          />
        </div>

        {/* Doctors Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredDoctors.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Stethoscope className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500">কোনো ডাক্তার নেই</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDoctors.map((doctor) => (
              <Card key={doctor.id} className="group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
                      {doctor.name?.charAt(2) || 'ডা'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{doctor.name}</h3>
                      <p className="text-sm mt-1">
                        <span className="text-primary-600 font-medium">{doctor.degree}</span>
                        <span className="text-slate-300 mx-1">•</span>
                        <span className="text-slate-600">{doctor.specialization}</span>
                      </p>
                      <p className="text-slate-500 text-sm mt-1">ফি: ৳{doctor.consultation_fee}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="w-4 h-4" />
                    <span>{doctor.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{doctor.email}</span>
                  </div>
                </div>

                {doctor.passcode && (
                  <div className="flex items-center justify-between bg-amber-50 p-3 rounded-xl mb-4">
                    <div>
                      <p className="text-xs text-amber-600">পাসকোড</p>
                      <p className="font-bold text-amber-800">{doctor.passcode}</p>
                    </div>
                    <button 
                      onClick={() => copyPasscode(doctor.passcode)}
                      className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button 
                    onClick={() => setScheduleDoctor(doctor)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-xl transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    শিফট
                  </button>
                  <button 
                    onClick={() => setDeleteDoctor(doctor)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    মুছুন
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Add Doctor Modal */}
        <Modal 
          isOpen={showAddModal} 
          onClose={() => { setShowAddModal(false); setShowPasscode(null); }}
          title={showPasscode ? undefined : "নতুন ডাক্তার যোগ করুন"}
          size="md"
        >
          {showPasscode ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">ডাক্তার যোগ হয়েছে!</h3>
              <p className="text-slate-600 mb-4">ডাক্তারের লগইন পাসকোড:</p>
              <div className="bg-amber-100 p-4 rounded-xl mb-4 inline-block">
                <p className="text-3xl font-bold text-amber-800">{showPasscode}</p>
              </div>
              <p className="text-sm text-slate-500 mb-6">এই পাসকোড ডাক্তারকে দিন</p>
              <Button onClick={() => { copyPasscode(showPasscode); setShowPasscode(null); setShowAddModal(false); }}>
                কপি করে বন্ধ করুন
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Input
                label="ডাক্তারের নাম"
                value={newDoctor.name}
                onChange={(e) => setNewDoctor({ ...newDoctor, name: e.target.value })}
                placeholder="ডাক্তারের নাম লিখুন"
              />
              <Input
                label="ইমেইল"
                type="email"
                value={newDoctor.email}
                onChange={(e) => setNewDoctor({ ...newDoctor, email: e.target.value })}
                placeholder="email@example.com"
              />
              <Input
                label="বিশেষজ্ঞতা"
                value={newDoctor.specialty}
                onChange={(e) => setNewDoctor({ ...newDoctor, specialty: e.target.value })}
                placeholder="যেমন: মেডিসিন, গাইনি"
              />
              <Input
                label="ডিগ্রি"
                value={newDoctor.degree}
                onChange={(e) => setNewDoctor({ ...newDoctor, degree: e.target.value })}
                placeholder="যেমন: MBBS, FCPS"
              />
              <Input
                label="ফোন নম্বর"
                type="tel"
                value={newDoctor.phone}
                onChange={(e) => setNewDoctor({ ...newDoctor, phone: e.target.value })}
                placeholder="০১১২৩৪৫৬৭৮৯"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="ফি (টাকা)"
                  type="number"
                  value={newDoctor.fee}
                  onChange={(e) => setNewDoctor({ ...newDoctor, fee: parseInt(e.target.value) || 0 })}
                />
                <Input
                  label="অভিজ্ঞতা"
                  value={newDoctor.experience}
                  onChange={(e) => setNewDoctor({ ...newDoctor, experience: e.target.value })}
                  placeholder="১০ বছর"
                />
              </div>
              <Input
                label="Zoom মিটিং লিংক (অপশনাল)"
                value={newDoctor.zoom_link}
                onChange={(e) => setNewDoctor({ ...newDoctor, zoom_link: e.target.value})}
                placeholder="https://zoom.us/j/xxxxxxxxx"
              />
              <Button onClick={handleAddDoctor} loading={saving} className="w-full">
                যোগ করুন
              </Button>
            </div>
          )}
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={!!deleteDoctor}
          onClose={() => { setDeleteDoctor(null); setAdminPasscode(''); setDoctorPasscode(''); }}
          title="ডাক্তার মুছুন"
          size="sm"
        >
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-500">ডাক্তার</p>
              <p className="font-semibold">{deleteDoctor?.name}</p>
            </div>

            <div>
              <label className="label">অ্যাডমিন পাসকোড</label>
              <input
                type="password"
                value={adminPasscode}
                onChange={(e) => setAdminPasscode(e.target.value)}
                className="input"
                placeholder="অ্যাডমিন পাসকোড"
              />
            </div>

            <div>
              <label className="label">ডাক্তারের পাসকোড</label>
              <input
                type="password"
                value={doctorPasscode}
                onChange={(e) => setDoctorPasscode(e.target.value)}
                className="input"
                placeholder="ডাক্তারের পাসকোড"
              />
            </div>

            <Button variant="danger" onClick={handleDeleteDoctor} className="w-full">
              নিশ্চিত করুন
            </Button>
          </div>
        </Modal>

        {/* Schedule Modal */}
        <Modal
          isOpen={!!scheduleDoctor}
          onClose={() => { 
            setScheduleDoctor(null); 
            setScheduleDate(''); 
            setScheduleStartTime(''); 
            setScheduleEndTime(''); 
            setIsRepeating(false); 
            setRepeatDays([]); 
          }}
          title="শিফট নির্ধারণ"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-500">ডাক্তার</p>
              <p className="font-semibold">{scheduleDoctor?.name}</p>
            </div>

            <DatePicker
              value={scheduleDate}
              onChange={setScheduleDate}
              className="!w-full"
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="শুরু সময়"
                type="time"
                value={scheduleStartTime}
                onChange={(e) => setScheduleStartTime(e.target.value)}
              />
              <Input
                label="শেষ সময়"
                type="time"
                value={scheduleEndTime}
                onChange={(e) => setScheduleEndTime(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="repeating"
                checked={isRepeating}
                onChange={(e) => setIsRepeating(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="repeating" className="text-sm text-slate-700">সাপ্তাহিক পুনরাবৃত্তি</label>
            </div>

            {isRepeating && (
              <div>
                <label className="label">পুনরাবৃত্তির দিন</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {days.map((d) => (
                    <button
                      key={d.day}
                      type="button"
                      onClick={() => {
                        if (repeatDays.includes(d.day)) {
                          setRepeatDays(repeatDays.filter(day => day !== d.day));
                        } else {
                          setRepeatDays([...repeatDays, d.day]);
                        }
                      }}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        repeatDays.includes(d.day)
                          ? 'bg-primary-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleAddSchedule} className="w-full">
              শিফট যোগ করুন
            </Button>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}