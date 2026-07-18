'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Plus, Search, X, Calendar, Clock, Trash2, UserPlus, User, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { sendNotification, requestPushPermission } from '@/lib/notifications';
import { Modal } from '@/components/ui/Modal';
import { StatusPill } from '@/components/ui/StatusPill';
import DatePicker from '@/components/ui/DatePicker';
import TimePicker from '@/components/ui/TimePicker';

const days = [
  { index: 0, name: 'রবিবার' },
  { index: 1, name: 'সোমবার' },
  { index: 2, name: 'মঙ্গলবার' },
  { index: 3, name: 'বুধবার' },
  { index: 4, name: 'বৃহস্পতিবার' },
  { index: 5, name: 'শুক্রবার' },
  { index: 6, name: 'শনিবার' },
];

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const getLocalDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayISO = getLocalDateString();

export default function AdminSchedule() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);

  const [filterDate, setFilterDate] = useState(todayISO);
  const [filterDoctor, setFilterDoctor] = useState('');
  const [filterSpecialization, setFilterSpecialization] = useState('');
  
  const [newShift, setNewShift] = useState({
    date: todayISO,
    doctor_id: '',
    start_time: '',
    end_time: '',
    repeat_weekly: false,
    selected_days: [] as number[],
  });

  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    loadData();
    
    if (localStorage.getItem('openShiftModal') === 'true') {
      localStorage.removeItem('openShiftModal');
      setTimeout(() => setShowModal(true), 500);
    }
  }, []);

  async function loadData() {
    setLoading(true);

    const { data: schedulesData } = await supabase
      .from('schedules')
      .select('*, doctors(name, specialization)')
      .order('start_date', { ascending: true });

    const { data: doctorsData } = await supabase
      .from('doctors')
      .select('*')
      .order('name');

    setSchedules(schedulesData || []);
    setDoctors(doctorsData || []);
    setLoading(false);
  }

  const uniqueSpecializations = [
    ...new Set(doctors.map((d) => d.specialization).filter(Boolean)),
  ] as string[];

  const dayMapping: { [key: number]: string } = {
    0: 'রবিবার',
    1: 'সোমবার',
    2: 'মঙ্গলবার',
    3: 'বুধবার',
    4: 'বৃহস্পতিবার',
    5: 'শুক্রবার',
    6: 'শনিবার',
  };

  const filteredSchedules = schedules.filter((s: any) => {
    if (filterDoctor && s.doctor_id !== filterDoctor) return false;
    
    if (
      filterSpecialization &&
      s.doctors?.specialization !== filterSpecialization
    ) return false;
    
    if (filterDate) {
      const startDate = s.start_date;
      const endDate = s.end_date;
      
      if (!startDate) return false;
      
      // Check if filterDate is within the date range
      if (endDate) {
        if (filterDate < startDate || filterDate > endDate) return false;
      } else {
        if (filterDate < startDate) return false;
      }
      
      // Check if the weekday of filterDate is in selected_days
      const filterDateObj = new Date(filterDate);
      const dayOfWeek = filterDateObj.getDay();
      const dayName = dayMapping[dayOfWeek];
      
      if (s.selected_days && !s.selected_days.includes(dayName)) return false;
    }
    
    return true;
  });

  const formatTime = (t: string) => {
    if (!t) return '';
    const hour = parseInt(t.split(':')[0]);
    const minute = t.split(':')[1]?.slice(0, 2) || '00';
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${String(hour12).padStart(2, '0')}:${minute} ${period}`;
  };

  const handleAddShift = async () => {
    if (!newShift.doctor_id) {
      toast.error('সব তথ্য পূরণ করুন');
      return;
    }

    if (newShift.selected_days.length === 0) {
      toast.error('দিন নির্বাচন করুন');
      return;
    }

    const startTime = newShift.start_time || '09:00';
    const endTime = newShift.end_time || '09:00';

    const dayNames = newShift.selected_days.map((dayIndex: number) => {
      const day = days.find(d => d.index === dayIndex);
      return day ? day.name : '';
    }).filter(Boolean);

    try {
      // Create separate row for each selected day
      const scheduleInserts = dayNames.map((dayName: string) => ({
        doctor_id: newShift.doctor_id,
        start_time: startTime,
        end_time: endTime,
        selected_days: [dayName], // One day per row
        repeat_weekly: newShift.repeat_weekly,
        start_date: newShift.date,
        status: 'pending',
      }));

      const { error } = await supabase.from('schedules').insert(scheduleInserts);

      if (error) {
        toast.error('শিফট যোগ করতে ব্যর্থ: ' + error.message);
      } else {
        requestPushPermission();
        
        const { data: doctor } = await supabase
          .from('doctors')
          .select('name')
          .eq('id', newShift.doctor_id)
          .single();

        try {
          await sendNotification('schedule_pending_doctor', {
            doctorId: newShift.doctor_id,
          }, {
            doctorName: doctor?.name,
            date: newShift.date,
            startTime: startTime,
            endTime: endTime,
            days: dayNames.join(', '),
          });
        } catch (e) {}

        const scheduleType = newShift.repeat_weekly ? 'প্রতি সপ্তাহের জন্য' : 'এই সপ্তাহের জন্য';
        toast.success(`${dayNames.length}টি শিফট যোগ হয়েছে! (${scheduleType})`);
      }

      setShowModal(false);
      setNewShift({
        date: todayISO,
        doctor_id: '',
        start_time: '',
        end_time: '',
        repeat_weekly: false,
        selected_days: [],
      });
      loadData();
    } catch (err) {
      toast.error('শিফট যোগ করতে ব্যর্থ');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('এই শিফট মুছে ফেলবেন?')) return;
    
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id);
    
    if (!error) {
      const { data: updatedSchedules } = await supabase
        .from('schedules')
        .select('*, doctors(name, specialization)')
        .order('start_date', { ascending: true });
      
      setSchedules(updatedSchedules || []);
      toast.success('শিফট মুছে ফেলা হয়েছে');
    }
  };

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
      <div className="space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              শিফট ম্যানেজমেন্ট
            </h1>
            <p className="text-slate-500">
              ডাক্তারের সময়সূচী নিয়ন্ত্রণ করুন
            </p>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-5 h-5" />
              নতুন শিফট
            </Button>
          </div>
        </div>

        {/* FILTER BAR */}
        <Card className="p-4 bg-white border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100">
                <Calendar className="w-5 h-5 text-slate-600" />
              </div>
              
              <div>
                <p className="text-xs text-slate-500">নির্বাচিত তারিখ</p>
                <p className="font-semibold text-slate-900">
                  {formatDate(filterDate)}
                </p>
              </div>
            </div>

              <div className="flex flex-wrap gap-3 items-center">
               
               <DatePicker
                 value={filterDate}
                 onChange={setFilterDate}
                 className="!w-[160px]"
               />
               
               <select
                 value={filterDoctor}
                 onChange={(e) => setFilterDoctor(e.target.value)}
                 className="px-3 py-2 border border-slate-300 rounded-lg"
               >
                <option value="">সব ডাক্তার</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              
              <select
                value={filterSpecialization}
                onChange={(e) => setFilterSpecialization(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="">সব বিভাগ</option>
                {uniqueSpecializations.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              
              <button
                onClick={() => setFilterDate(todayISO)}
                className="px-4 py-2 text-white rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-600 transition shadow-md"
              >
                Today
              </button>
              
            </div>
          </div>
        </Card>

        {/* TABLE */}
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left">তারিখ</th>
                  <th className="px-4 py-3 text-left">দিন</th>
                  <th className="px-4 py-3 text-left">ডাক্তার</th>
                  <th className="px-4 py-3 text-left">বিভাগ</th>
                  <th className="px-4 py-3 text-left">সময়</th>
                  <th className="px-4 py-3 text-left">স্ট্যাটাস</th>
                  <th className="px-4 py-3 text-left">অ্যাকশন</th>
                </tr>
              </thead>

              <tbody>
                {filteredSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      কোনো শিফট নেই
                    </td>
                  </tr>
                ) : (
                  filteredSchedules.map((s: any) => (
                    <tr key={s.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3">
                        {filterDate ? (
                          <span className="font-medium text-primary-600">{formatDate(filterDate)}</span>
                        ) : (
                          <>
                            {s.start_date ? formatDate(s.start_date) : '-'}
                            {s.end_date && ` - ${formatDate(s.end_date)}`}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.selected_days?.map((day: string) => (
                          <span key={day} className="inline-block px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs mr-1 mb-1">
                            {day}
                          </span>
                        )) || '-'}
                      </td>
                      <td className="px-4 py-3">{s.doctors?.name}</td>
                      <td className="px-4 py-3">
                        {s.doctors?.specialization}
                      </td>
                      <td className="px-4 py-3 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatTime(s.start_time)} - {formatTime(s.end_time)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={s.status} />
                        {s.repeat_weekly && (
                          <span className="ml-2 text-xs text-purple-600">(পুনরাবৃত্তি)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingSchedule(s);
                              setShowEditModal(true);
                            }}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                            title="সম্পাদনা"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* MODAL */}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="নতুন শিফট"
        >
          <div className="space-y-5">
            
            <DatePicker
              value={newShift.date}
              onChange={(date) => setNewShift({ ...newShift, date })}
              className="!w-full"
            />
            
            <select
              value={newShift.doctor_id}
              onChange={(e) =>
                setNewShift({ ...newShift, doctor_id: e.target.value })
              }
              className="input"
            >
              <option value="">ডাক্তার নির্বাচন করুন</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-600 mb-2 block">শুরুর সময়</label>
                <TimePicker
                  value={newShift.start_time}
                  onChange={(time) => setNewShift({ ...newShift, start_time: time })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 mb-2 block">শেষের সময়</label>
                <TimePicker
                  value={newShift.end_time}
                  onChange={(time) => setNewShift({ ...newShift, end_time: time })}
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="mt-3">
              <p className="text-sm font-medium text-slate-600 mb-2">দিন নির্বাচন করুন *</p>
              <div className="flex flex-wrap gap-2">
                {days.map((day) => (
                  <button
                    key={day.index}
                    type="button"
                    onClick={() => {
                      const selected = newShift.selected_days.includes(day.index)
                        ? newShift.selected_days.filter(d => d !== day.index)
                        : [...newShift.selected_days, day.index];
                      setNewShift({ ...newShift, selected_days: selected });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      newShift.selected_days.includes(day.index)
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'bg-white text-slate-600 border border-purple-200 hover:bg-purple-50'
                    }`}
                  >
                    {day.name}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-3 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 cursor-pointer hover:from-purple-100 hover:to-indigo-100 transition mt-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={newShift.repeat_weekly}
                      onChange={(e) =>
                        setNewShift({ ...newShift, repeat_weekly: e.target.checked })
                      }
                      className="w-6 h-6 rounded-lg border-2 border-purple-300 text-purple-600 focus:ring-purple-500 focus:ring-offset-2 cursor-pointer"
                      style={{ accentColor: '#9333ea' }}
                    />
                  </div>
                  <span className="text-base font-semibold text-purple-800">
                    সাপ্তাহিক পুনরাবৃত্তি
                  </span>
                </div>
                {newShift.repeat_weekly && (
                  <div className="mt-3">
                    <p className="text-xs text-purple-600 mb-2">প্রতি সপ্তাহে এই দিনগুলোতে শিফট সক্রিয় থাকবে</p>
                  </div>
                )}
              </div>
            </label>

            <Button onClick={handleAddShift} className="w-full">
              শিফট যোগ করুন
            </Button>
          </div>
        </Modal>

        {/* EDIT MODAL */}
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingSchedule(null);
          }}
          title="শিফট সম্পাদনা"
        >
          {editingSchedule && (
            <div className="space-y-5">
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="font-medium text-slate-900">{editingSchedule.doctors?.name}</p>
                <p className="text-sm text-slate-500">{editingSchedule.doctors?.specialization}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-600 mb-2">দিন নির্বাচন করুন (যেদিন চেঞ্জ করবেন)</p>
                <div className="flex flex-wrap gap-2">
                  {days.map((day) => {
                    const isSelected = editingSchedule.selected_days?.includes(day.name);
                    return (
                      <button
                        key={day.index}
                        type="button"
                        onClick={() => {
                          const selected = isSelected
                            ? editingSchedule.selected_days.filter((d: string) => d !== day.name)
                            : [...(editingSchedule.selected_days || []), day.name];
                          setEditingSchedule({ ...editingSchedule, selected_days: selected });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-purple-500 text-white shadow-md'
                            : 'bg-white text-slate-600 border border-purple-200 hover:bg-purple-50'
                        }`}
                      >
                        {day.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-600 mb-2 block">শুরুর সময়</label>
                  <TimePicker
                    value={editingSchedule.start_time || ''}
                    onChange={(time) => setEditingSchedule({ ...editingSchedule, start_time: time })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 mb-2 block">শেষের সময়</label>
                  <TimePicker
                    value={editingSchedule.end_time || ''}
                    onChange={(time) => setEditingSchedule({ ...editingSchedule, end_time: time })}
                    className="w-full"
                  />
                </div>
              </div>

              <Button
                onClick={async () => {
                  if (!editingSchedule || !editingSchedule.id) return;

                  const { error } = await supabase
                    .from('schedules')
                    .update({
                      start_time: editingSchedule.start_time,
                      end_time: editingSchedule.end_time,
                      selected_days: editingSchedule.selected_days,
                      status: 'pending',
                    })
                    .eq('id', editingSchedule.id);

                  if (error) {
                    toast.error('আপডেট করতে সমস্যা হয়েছে: ' + error.message);
                  } else {
                    toast.success('শিফট আপডেট হয়েছে');
                    setShowEditModal(false);
                    setEditingSchedule(null);
                    loadData();
                  }
                }}
                className="w-full"
              >
                আপডেট করুন
              </Button>
            </div>
          )}
        </Modal>

      </div>
    </DashboardLayout>
  );
}
