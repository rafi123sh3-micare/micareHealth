'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Search, Calendar, Clock, Video, CheckCircle, X, FileText, ChevronDown, Upload, Check, Plus, Zap } from 'lucide-react';
import { supabase, supabase1, generateSerialNumber } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { QRCode } from '@/components/ui/QRCode';
import DatePicker from '@/components/ui/DatePicker';
import toast from 'react-hot-toast';
import { sendNotification, requestPushPermission } from '@/lib/notifications';
import { sendSMS, buildConfirmationSMS } from '@/lib/sms';
import { motion } from 'framer-motion';

const statusConfig = {
  pending: { value: 'pending', label: 'অপেক্ষায়' },
  confirmed: { value: 'confirmed', label: 'নিশ্চিত' },
  upcoming: { value: 'upcoming', label: 'আসন্ন' },
  completed: { value: 'completed', label: 'সম্পন্ন' },
  cancelled: { value: 'cancelled', label: 'বাতিল' },
};
// Cache history templates to avoid repeated network calls
let historyTemplatesCache: any[] | null = null;
const STORAGE_KEY = 'history_templates_cache';

function loadCachedTemplates(): any[] | null {
  if (historyTemplatesCache) return historyTemplatesCache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { const p = JSON.parse(raw); historyTemplatesCache = p; return p; }
  } catch {}
  return null;
}

function saveCachedTemplates(templates: any[]) {
  historyTemplatesCache = templates;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(templates)); } catch {}
}

const FALLBACK_HISTORY = [
  { id: 'demo-1', disease_name: 'ডায়াবেটিস', question: 'আপনার বর্তমান সুগার লেভেল কত?', type: 'paragraph' as const, options: [], required: false },
  { id: 'demo-2', disease_name: 'ডায়াবেটিস', question: 'কখন শেষবার চেক করেছিলেন?', type: 'paragraph' as const, options: [], required: false },
  { id: 'demo-3', disease_name: 'উচ্চ রক্তচাপ', question: 'আপনার বর্তমান প্রেসার কত?', type: 'paragraph' as const, options: [], required: false },
  { id: 'demo-4', disease_name: 'উচ্চ রক্তচাপ', question: 'ওষুধ নিয়মিত খান?', type: 'paragraph' as const, options: [], required: false },
  { id: 'demo-5', disease_name: 'হৃদরোগ', question: 'বুকে ব্যথা অনুভব করছেন?', type: 'paragraph' as const, options: [], required: false },
  { id: 'demo-6', disease_name: 'হৃদরোগ', question: 'শ্বাস নিতে কষ্ট হচ্ছে?', type: 'paragraph' as const, options: [], required: false },
];

const TYPE_MAP: Record<string, string> = {
  'text': 'text', 'Short Text': 'text',
  'paragraph': 'paragraph', 'Paragraph': 'paragraph',
  'multiple_choice': 'multiple_choice', 'Multiple Choice': 'multiple_choice',
  'checkboxes': 'checkboxes', 'Checkboxes': 'checkboxes',
  'dropdown': 'dropdown', 'Dropdown': 'dropdown',
  'file_upload': 'file_upload', 'Media Upload': 'file_upload',
  'date': 'date', 'Date': 'date',
  'time': 'time', 'Time': 'time',
  'scale': 'scale', 'Linear Scale': 'scale', 'linear_scale': 'scale',
};

function processHistoryTemplates(templates: any[]): any[] {
  return (templates || []).flatMap((row: any) =>
    (row.questions || []).map((q: any, idx: number) => {
      if (typeof q === 'string') return { id: `${row.id}_${idx}`, disease_name: row.disease_name, question: q, type: 'paragraph', options: [], required: false };
      const rawType = q.type || 'paragraph';
      const normalizedType = TYPE_MAP[rawType] || 'text';
      let options = q.options || [];
      if (normalizedType === 'scale' && (!options || options.length === 0)) {
        const max = q.scaleMax || 5;
        options = Array.from({ length: max }, (_, i) => String(i + 1));
      }
      return {
        id: q.id || `${row.id}_${idx}`,
        disease_name: row.disease_name,
        question: q.text || q.question || '',
        type: normalizedType,
        options,
        required: q.required || false,
        acceptTypes: q.acceptTypes || [],
      };
    })
  );
}

const getLocalDateString = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().split('T')[0];
};

export default function DoctorAppointments() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(getLocalDateString());
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [showPrescribeConfirm, setShowPrescribeConfirm] = useState(false);
  const [prescribePatient, setPrescribePatient] = useState<any>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPatient, setHistoryPatient] = useState<any>(null);
  const [historyQuestions, setHistoryQuestions] = useState<any[]>([]);
  const [historyAnswers, setHistoryAnswers] = useState<{[key: string]: string}>({});
  const [historyStep, setHistoryStep] = useState(0);
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [walkinPatient, setWalkinPatient] = useState({
    name: '',
    phone: '',
    age: 0 as number,
    sex: '' as 'male' | 'female' | 'other',
    weight: 0 as number,
    type: 'in-person' as 'in-person' | 'teleconsult',
    date: getLocalDateString(),
    time: '',
    reason: '',
    compliant: '',
  });
  const [creatingWalkin, setCreatingWalkin] = useState(false);
  const [specialTimePower, setSpecialTimePower] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrAppointment, setQRAppointment] = useState<any>(null);

  useEffect(() => {
    loadAppointments();
  }, []);

  // Eagerly prefetch history templates for instant History modal
  useEffect(() => {
    if (!loadCachedTemplates()) {
      supabase1.from('history_templates').select('*').then(({ data }) => {
        if (data) saveCachedTemplates(data);
      });
    }
  }, []);

useEffect(() => {
  const interval = setInterval(() => {
    setFilterDate(getLocalDateString());
  }, 60000);

  return () => clearInterval(interval);
}, []);
  const getStatusFromDate = (dateStr: string, currentStatus: string) => {
    if (currentStatus === 'cancelled') return 'cancelled';
    if (currentStatus === 'completed') return 'completed';
    if (currentStatus === 'pending') return 'pending';
    if (currentStatus === 'confirmed') return 'confirmed';
    const appointmentDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (appointmentDate < today) return 'completed';
    return 'upcoming';
  };

  async function loadAppointments() {
    const doctorData = JSON.parse(localStorage.getItem('doctorData') || 'null');

    if (!doctorData) {
      toast.error('ডাক্তার সেশন শেষ হয়ে গেছে। দয়া করে আবার লগইন করুন।');
      setLoading(false);
      return;
    }

    const { data: apts, error: aptError } = await supabase
      .from('appointments')
      .select('*, patients(name, phone)')
      .eq('doctor_id', doctorData.id)
      .order('date', { ascending: false });

    if (aptError) {
      console.error('Error fetching appointments:', aptError);
      toast.error('অ্যাপয়েন্টমেন্ট লোড করতে সমস্যা হয়েছে');
    }

    if (apts) {
      const mapped = apts.map((apt: any) => {
        const timeRange = apt.time 
          ? formatTime(apt.time)
          : '';

        return {
          ...apt,
          patientName: apt.patients?.name || 'রোগী',
          patientPhone: apt.patients?.phone || '',
          time_display: timeRange,
          displayStatus: getStatusFromDate(apt.date, apt.status),
        };
      });

const statusOrder: Record<string, number> = {
        pending: 1,
        confirmed: 2,
        completed: 3,
        upcoming: 2,
        cancelled: 4,
      };

      const sorted = mapped.sort((a, b) => {
        const aStatus = a.displayStatus;
        const bStatus = b.displayStatus;
        return (statusOrder[aStatus] || 99) - (statusOrder[bStatus] || 99);
      });

      setAppointments(sorted);
    }
    setLoading(false);
  }

  const filteredAppointments = appointments.filter(apt => {
    if (filterDate && apt.date !== filterDate) return false;
    if (filterStatus && apt.displayStatus !== filterStatus) return false;
    if (filterType && apt.type !== filterType) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      if (!apt.patientName?.toLowerCase().includes(searchLower)) return false;
    }
    return true;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (timeStr: string) => timeStr ? timeStr.substring(0, 5) : '';

  async function updateStatus(aptId: string, newStatus: string) {
    const doctorData = JSON.parse(localStorage.getItem('doctorData') || 'null');

    const { data: apt } = await supabase
      .from('appointments')
      .select('*, patients(name, phone), doctors(name)')
      .eq('id', aptId)
      .single();

    let updateData: any = { status: newStatus };

    if (newStatus === 'confirmed' && !apt?.serial_number) {
      const serialNumber = await generateSerialNumber(
        apt.doctor_id,
        apt.date,
        apt.type === 'teleconsult' ? 'teleconsult' : 'appointment'
      );
      updateData.serial_number = serialNumber;
    }

    const { error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', aptId);

    if (!error && apt) {
      requestPushPermission();

      if (newStatus === 'confirmed') {
        try {
          await sendNotification('appointment_confirmed_patient', {
            patientId: apt.patient_id,
          }, {
            patientName: apt.patients?.name,
            doctorName: apt.doctors?.name,
            date: apt.date,
          });
        } catch (e) {}

        try {
          await sendNotification('appointment_confirmed_doctor', {
            doctorId: doctorData?.id,
          }, {
            patientName: apt.patients?.name,
            date: apt.date,
          });
        } catch (e) {}

        try {
          const patientPhone = apt.patients?.phone;
          if (patientPhone) {
            const smsText = buildConfirmationSMS(
              apt.doctors?.name || '',
              apt.date,
              apt.time || '',
              updateData.serial_number || apt.serial_number || ''
            );
            await sendSMS(patientPhone, smsText);
          }
        } catch (e) {
          console.error('SMS sending error:', e);
        }

        if (apt.type === 'teleconsult') {
          try {
            await sendNotification('teleconsult_ready_patient', {
              patientId: apt.patient_id,
            }, {
              doctorName: apt.doctors?.name,
            });
          } catch (e) {}
        }
      } else if (newStatus === 'cancelled') {
        try {
          await sendNotification('appointment_cancelled_patient', {
            patientId: apt.patient_id,
          }, {
            patientName: apt.patients?.name,
            doctorName: apt.doctors?.name,
          });
        } catch (e) {}

        try {
          await sendNotification('appointment_cancelled_doctor', {
            doctorId: doctorData?.id,
          }, {
            patientName: apt.patients?.name,
            date: apt.date,
          });
        } catch (e) {}

        try {
          await sendNotification('appointment_cancelled_admin', {
            adminIds: [],
          }, {
            patientName: apt.patients?.name,
            doctorName: apt.doctors?.name,
          });
        } catch (e) {}

        if (apt.type === 'teleconsult') {
          try {
            await sendNotification('teleconsult_cancelled_patient', {
              patientId: apt.patient_id,
            }, {
              doctorName: apt.doctors?.name,
            });
          } catch (e) {}

          try {
            await sendNotification('teleconsult_cancelled_doctor', {
              doctorId: doctorData?.id,
            }, {
              patientName: apt.patients?.name,
              date: apt.date,
            });
          } catch (e) {}
        }
      }

      toast.success('স্ট্যাটাস আপডেট হয়েছে');
      loadAppointments();
    }
  }

  const handleApprove = async (apt: any, currentStatus: string) => {
    let newStatus: string;
    if (currentStatus === 'pending') newStatus = 'confirmed';
    else if (currentStatus === 'confirmed') newStatus = 'pending';
    else if (currentStatus === 'cancelled') newStatus = 'confirmed';
    else newStatus = 'confirmed';

    if (!apt || !apt.id) {
      toast.error('অ্যাপয়েন্টমেন্ট খুঁজে পাওয়া যায়নি');
      return;
    }

    let updateData: any = { status: newStatus };

    if ((newStatus === 'confirmed' || newStatus === 'completed') && !apt.serial_number) {
      const serialNumber = await generateSerialNumber(
        apt.doctor_id,
        apt.date,
        apt.type === 'teleconsult' ? 'teleconsult' : 'appointment'
      );
      updateData.serial_number = serialNumber;
    }

    const { error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', apt.id);

    if (error) {
      toast.error('স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে');
    } else {
      requestPushPermission();
      if (newStatus === 'confirmed') {
        try { await sendNotification('appointment_confirmed_patient', { patientId: apt.patient_id }, { patientName: apt.patients?.name, doctorName: apt.doctors?.name, date: apt.date }); } catch(e) {}
        try { await sendNotification('appointment_confirmed_doctor', { doctorId: apt.doctor_id }, { patientName: apt.patients?.name, date: apt.date }); } catch(e) {}
        try { const p = apt.patients?.phone; if(p) { await sendSMS(p, buildConfirmationSMS(apt.doctors?.name||'', apt.date, apt.time||'', apt.serial_number||'')); } } catch(e) {}
      }
      toast.success(newStatus === 'confirmed' ? 'নিশ্চিত হয়েছে' : 'অপেক্ষায় সেট করা হয়েছে');
      loadAppointments();
    }
  };

  const handleReject = async (apt: any) => {
    if (!apt || !apt.id) { toast.error('অ্যাপয়েন্টমেন্ট খুঁজে পাওয়া যায়নি'); return; }
    if (!confirm('এই অ্যাপয়েন্টমেন্ট বাতিল করতে চান?')) return;
    const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', apt.id);
    if (!error) { toast.success('অ্যাপয়েন্টমেন্ট বাতিল হয়েছে'); loadAppointments(); }
  };

  const handleComplete = async (apt: any) => {
    const { error } = await supabase.from('appointments').update({ status: 'completed' }).eq('id', apt.id);
    if (!error) {
      await supabase.from('patients').update({ status: 'completed' }).eq('id', apt.patient_id);
      toast.success('অ্যাপয়েন্টমেন্ট সম্পন্ন হয়েছে');
      loadAppointments();
    }
  };

  const handleAddWalkin = async () => {
    const doctorData = JSON.parse(localStorage.getItem('doctorData') || 'null');
    if (!walkinPatient.name) { toast.error('রোগীর নাম লিখুন'); return; }
    setCreatingWalkin(true);
    try {
      // Always create a new patient record for each walk-in (even if name/phone match)
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const { data: newPatient, error: patientError } = await supabase.from('patients').insert({
        name: walkinPatient.name, phone: walkinPatient.phone || '', email: `walkin_${uniqueSuffix}@clinicconnect.local`,
        password: 'walkin_temp', age: walkinPatient.age, sex: walkinPatient.sex || 'male',
        weight: walkinPatient.weight, compliant: walkinPatient.compliant || 'false',
      }).select('id').single();
      if (patientError || !newPatient) { toast.error('রোগী তৈরি করতে ব্যর্থ'); setCreatingWalkin(false); return; }
      const getCurrentTime = () => { const n=new Date(); return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`; };
      const appointmentTime = specialTimePower ? getCurrentTime() : (walkinPatient.time ? walkinPatient.time.split(' - ')[0] : '09:00');
      const type = walkinPatient.type === 'teleconsult' ? 'teleconsult' : 'appointment';
      const serialNumber = await generateSerialNumber(doctorData.id, walkinPatient.date, type);
      const { error: aptError } = await supabase.from('appointments').insert({
        patient_id: newPatient.id, doctor_id: doctorData.id, date: walkinPatient.date,
        time: appointmentTime, status: 'confirmed', type: walkinPatient.type,
        reason: walkinPatient.reason || 'ওয়াক-ইন', serial_number: serialNumber,
      });
      if (aptError) { toast.error('অ্যাপয়েন্টমেন্ট তৈরি করতে ব্যর্থ'); setCreatingWalkin(false); return; }
      const { data: createdApt } = await supabase.from('appointments').select('*, patients(*), doctors(*)').eq('patient_id', newPatient.id).order('created_at', { ascending: false }).limit(1).single();
      toast.success('অ্যাপয়েন্টমেন্ট যোগ হয়েছে');
      setQRAppointment(createdApt);
      setShowQRModal(true);
      setShowWalkinModal(false);
      setWalkinPatient({ name: '', phone: '', age: 0, sex: 'male', weight: 0, type: 'in-person', date: getLocalDateString(), time: '', reason: '', compliant: '' });
      setSpecialTimePower(false);
      loadAppointments();
    } catch(err) { toast.error('কিছু সমস্যা হয়েছে'); }
    finally { setCreatingWalkin(false); }
  };

  const getStatusBadge = (status: string, displayStatus: string) => {
    if (displayStatus === 'upcoming' || displayStatus === 'pending') {
      if (status === 'pending') return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">অপেক্ষায়</span>;
      else if (status === 'confirmed') return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">নিশ্চিত</span>;
    }
    return <StatusPill status={displayStatus as any} />;
  };

  const handlePrescribe = async (apt: any) => {
    setPrescribePatient({ patient_id: apt.patient_id });
    setShowPrescribeConfirm(true);
  };

  const handleHistory = async (apt: any) => {
    setHistoryPatient({ patient_id: apt.patient_id, patient_name: apt.patientName, appointment_id: apt.id });
    setHistoryAnswers({});
    setHistoryStep(-1);

    const cached = loadCachedTemplates();
    if (cached) {
      setHistoryQuestions(processHistoryTemplates(cached));
      setHistoryLoading(false);
      setShowHistoryModal(true);
      const { data: existingHistory } = await supabase
        .from('patient_history').select('*').eq('patient_id', apt.patient_id);
      const existingAnswers: {[key: string]: string} = {};
      if (existingHistory) existingHistory.forEach((h: any) => { existingAnswers[h.question_id] = h.answer; });
      setHistoryAnswers(existingAnswers);
      const { data: freshTemplates } = await supabase1.from('history_templates').select('*');
      if (freshTemplates) {
        saveCachedTemplates(freshTemplates);
        const freshQuestions = processHistoryTemplates(freshTemplates);
        setHistoryQuestions(freshQuestions.length > 0 ? freshQuestions : FALLBACK_HISTORY);
      }
      return;
    }

    setHistoryQuestions([]);
    setHistoryLoading(true);
    setShowHistoryModal(true);

    try {
      const [templatesResult, existingHistoryResult] = await Promise.all([
        supabase1.from('history_templates').select('*'),
        supabase.from('patient_history').select('*').eq('patient_id', apt.patient_id),
      ]);

      const { data: templates, error: templatesError } = templatesResult;
      const { data: existingHistory } = existingHistoryResult;

      if (templatesError) console.error('Error fetching history_templates:', templatesError);
      if (templates) saveCachedTemplates(templates);

      const flatQuestions = processHistoryTemplates(templates || []);

      const existingAnswers: {[key: string]: string} = {};
      if (existingHistory) existingHistory.forEach((h: any) => { existingAnswers[h.question_id] = h.answer; });
      setHistoryAnswers(existingAnswers);

      setHistoryQuestions(flatQuestions.length > 0 ? flatQuestions : FALLBACK_HISTORY);
    } catch (err) {
      console.error('handleHistory crashed:', err);
      setHistoryQuestions(FALLBACK_HISTORY);
    } finally {
      setHistoryLoading(false);
    }
  };

  const submitHistoryAnswers = async () => {
    if (!historyPatient) return;
    const loadingToast = toast.loading('সংরক্ষণ করা হচ্ছে...');
    await supabase.from('patient_history').delete().eq('patient_id', historyPatient.patient_id);
    const answersToInsert = Object.entries(historyAnswers).map(([question_id, answer]) => {
      const q = historyQuestions.find((hq: any) => hq.id === question_id);
      return { patient_id: historyPatient.patient_id, question_id, disease_name: q?.disease_name || '', question: q?.question || '', answer };
    });
    if (answersToInsert.length === 0) { toast.dismiss(loadingToast); toast.success('ইতিহাস সংরক্ষিত হয়েছে'); setShowHistoryModal(false); return; }
    const { error } = await supabase.from('patient_history').insert(answersToInsert);
    toast.dismiss(loadingToast);
    if (!error) { toast.success('ইতিহাস সংরক্ষিত হয়েছে'); setShowHistoryModal(false); }
    else toast.error('ইতিহাস সংরক্ষণে সমস্যা হয়েছে');
  };

  if (loading) {
    return (
      <DashboardLayout role="doctor">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="doctor">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 page-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">অ্যাপয়েন্টমেন্ট</h1>
            <p className="text-slate-500 mt-1">সকল অ্যাপয়েন্টমেন্ট দেখুন ও পরিচালনা করুন</p>
          </div>
          <Button onClick={() => setShowWalkinModal(true)}><Plus className="w-5 h-5" /> নতুন অ্যাপয়েন্টমেন্ট</Button>
        </div>

        <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-lg shadow-slate-200/20">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="min-w-[160px]">
              <label className="text-sm font-medium text-slate-600 mb-2 block">তারিখ</label>
              <DatePicker value={filterDate} onChange={setFilterDate} className="!w-full" />
            </div>
            <div className="min-w-[160px]">
              <label className="text-sm font-medium text-slate-600 mb-2 block">ধরন</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input">
                <option value="">সব ধরন</option>
                <option value="walkin">সরাসরি ভিজিট</option>
                <option value="teleconsult">ভিডিও কল</option>
              </select>
            </div>
            <div className="min-w-[160px]">
              <label className="text-sm font-medium text-slate-600 mb-2 block">স্ট্যাটাস</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input">
                <option value="">সব স্ট্যাটাস</option>
                {Object.values(statusConfig).map(s => (<option key={s.value} value={s.value}>{s.label}</option>))}
              </select>
            </div>
            <div className="flex-1 min-w-[150px] sm:min-w-[200px]">
              <label className="text-sm font-medium text-slate-600 mb-2 block">খুঁজুন</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="রোগী খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10 w-full" />
              </div>
            </div>
          </div>
        </Card>

        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">সিরিয়াল</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">রোগী</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">মোবাইল নম্বর</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">তারিখ ও সময়</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">ধরন</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">স্ট্যাটাস</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">সম্পন্ন</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600"></th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Calendar className="w-7 h-7 text-slate-400" />
                      </div>
                      <p className="text-slate-500">নির্বাচিত তারিখে কোনো অ্যাপয়েন্টমেন্ট নেই</p>
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((apt, index) => (
                    <motion.tr key={apt.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-slate-400 font-mono text-xs mr-2">{index + 1}</span>
                        <span className="text-slate-600 font-mono">{(apt.status === 'confirmed' || apt.status === 'completed') && apt.serial_number ? apt.serial_number : '-'}</span>
                      </td>
                      <td className="px-4 py-3"><span className="font-medium text-slate-900">{apt.patientName}</span></td>
                      <td className="px-4 py-3"><div className="text-xs text-slate-500">{apt.patientPhone || '-'}</div></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDate(apt.date)}</span>
                          {apt.time && <span className="text-xs text-slate-400">- {formatTime(apt.time)}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs ${apt.type === 'teleconsult' ? 'text-purple-600' : 'text-slate-600'}`}>
                          {apt.type === 'teleconsult' && <Video className="w-3 h-3" />}
                          {apt.type === 'teleconsult' ? 'ভিডিও' : 'সরাসরি'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(apt.status, apt.displayStatus)}</td>
                      <td className="px-4 py-3 text-center">
                        {apt.status !== 'completed' && apt.status !== 'cancelled' ? (
                          <button onClick={() => handleComplete(apt)} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="সম্পন্ন করুন">
                            <CheckCircle className="w-5 h-5" />
                          </button>
                        ) : (
                          <div className="flex justify-center"><CheckCircle className="w-5 h-5 text-emerald-400 opacity-50" /></div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {apt.status !== 'completed' && (
                            <>
                              {apt.status === 'pending' && (
                                <>
                                  <button onClick={() => handleApprove(apt, apt.status)} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="নিশ্চিত করুন"><Check className="w-4 h-4" /></button>
                                  <button onClick={() => handleReject(apt)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="বাতিল করুন"><X className="w-4 h-4" /></button>
                                </>
                              )}
                              {apt.status === 'confirmed' && (
                                <button onClick={() => handleApprove(apt, apt.status)} className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="অপেক্ষায় করুন"><Clock className="w-4 h-4" /></button>
                              )}
                              {apt.status === 'cancelled' && (
                                <button onClick={() => handleApprove(apt, apt.status)} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="পুনরুদ্ধার করুন"><Check className="w-4 h-4" /></button>
                              )}
                              <button onClick={() => handlePrescribe(apt)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="প্রেসক্রিব"><FileText className="w-4 h-4" /></button>
                              <button onClick={() => handleHistory(apt)} className="p-2 text-purple-500 hover:bg-purple-50 rounded-lg transition-colors" title="ইতিহাস"><FileText className="w-4 h-4" /></button>
                            </>
                          )}
                          {apt.status === 'completed' && (
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handlePrescribe(apt)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="প্রেসক্রিব"><FileText className="w-4 h-4" /></button>
                              <button onClick={() => handleHistory(apt)} className="p-2 text-purple-500 hover:bg-purple-50 rounded-lg transition-colors" title="ইতিহাস"><FileText className="w-4 h-4" /></button>
                            </div>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>

      <Modal isOpen={showWalkinModal} onClose={() => setShowWalkinModal(false)} title="নতুন অ্যাপয়েন্টমেন্ট">
        <div className="space-y-5">
          <div><label className="text-sm font-medium text-slate-600 mb-2 block">রোগীর নাম *</label><input type="text" value={walkinPatient.name} onChange={(e) => setWalkinPatient({...walkinPatient, name: e.target.value})} className="input w-full" placeholder="রোগীর নাম লিখুন" /></div>
          <div><label className="text-sm font-medium text-slate-600 mb-2 block">ফোন নম্বর</label><input type="tel" value={walkinPatient.phone} onChange={(e) => setWalkinPatient({...walkinPatient, phone: e.target.value})} className="input w-full" placeholder="01XXXXXXXXX" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-sm font-medium text-slate-600 mb-2 block">বয়স *</label><input type="number" value={walkinPatient.age} onChange={(e) => setWalkinPatient({...walkinPatient, age: parseInt(e.target.value) || 0})} className="input w-full" /></div>
            <div><label className="text-sm font-medium text-slate-600 mb-2 block">লিঙ্গ *</label><select value={walkinPatient.sex} onChange={(e) => setWalkinPatient({...walkinPatient, sex: e.target.value as 'male'|'female'|'other'})} className="input w-full"><option value="">লিঙ্গ নির্বাচন করুন</option><option value="male">পুরুষ</option><option value="female">মহিলা</option><option value="other">অন্যান্য</option></select></div>
            <div><label className="text-sm font-medium text-slate-600 mb-2 block">ওজন (kg)</label><input type="number" value={walkinPatient.weight} onChange={(e) => setWalkinPatient({...walkinPatient, weight: parseFloat(e.target.value) || 0})} className="input w-full" /></div>
          </div>
          <div><label className="text-sm font-medium text-slate-600 mb-2 block">ধরন</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setWalkinPatient({...walkinPatient, type: 'in-person'})} className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${walkinPatient.type === 'in-person' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 hover:border-slate-300'}`}>সরাসরি</button>
              <button type="button" onClick={() => setWalkinPatient({...walkinPatient, type: 'teleconsult'})} className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${walkinPatient.type === 'teleconsult' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 hover:border-slate-300'}`}>ভিডিও কল</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium text-slate-600 mb-2 block">তারিখ</label><input type="date" value={walkinPatient.date} onChange={(e) => setWalkinPatient({...walkinPatient, date: e.target.value, time: ''})} className="input w-full" /></div>
            <div>
              <label className="text-sm font-medium text-slate-600 mb-2 block">সময় *</label>
              <div className="flex items-center gap-2 mb-2">
                <button type="button" onClick={() => setSpecialTimePower(!specialTimePower)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${specialTimePower ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}><Zap className="w-4 h-4" /> বিশেষ ক্ষমতা ~ সময়</button>
              </div>
              {specialTimePower && <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg mb-2">বর্তমান সময় ব্যবহার করা হবে</div>}
              <input type="time" value={walkinPatient.time} onChange={(e) => setWalkinPatient({...walkinPatient, time: e.target.value})} className="input w-full" disabled={specialTimePower} />
            </div>
          </div>
          <div><label className="text-sm font-medium text-slate-600 mb-2 block">রোগীর সমস্যা লিখুন</label><textarea value={walkinPatient.reason} onChange={(e) => setWalkinPatient({...walkinPatient, reason: e.target.value})} className="input w-full h-24 resize-none" placeholder="রোগীর সমস্যা লিখুন" /></div>
          <Button onClick={handleAddWalkin} className="w-full" disabled={creatingWalkin}>{creatingWalkin ? 'যোগ হচ্ছে...' : 'অ্যাপয়েন্টমেন্ট যোগ করুন'}</Button>
        </div>
      </Modal>

      <Modal isOpen={showQRModal} onClose={() => setShowQRModal(false)} title="অ্যাপয়েন্টমেন্ট QR কোড" size="sm">
        {qrAppointment && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center" id="qr-code-print-area"><QRCode value={`${window.location.origin}/dashboard/patient/appointments?id=${qrAppointment.id}`} size={200} /></div>
            <div className="space-y-2"><p className="font-semibold">{qrAppointment.patients?.name}</p><p className="text-sm text-slate-500">{formatDate(qrAppointment.date)} - {qrAppointment.time?.substring(0, 5)}</p></div>
            <Button onClick={() => { const pw = window.open('','_blank'); if(pw) { const qs=document.querySelector('#qr-code-print-area svg'); const sh=qs?qs.outerHTML:''; pw.document.write(`<html><head><title>QR কোড</title></head><body style="text-align:center;padding:20px;font-family:sans-serif;"><h2>ক্লিনিক কানেক্ট - অ্যাপয়েন্টমেন্ট</h2><p>রোগী: ${qrAppointment.patients?.name}</p><p>তারিখ: ${formatDate(qrAppointment.date)}</p><p>সময়: ${qrAppointment.time?.substring(0,5)}</p>${sh}</body></html>`); pw.document.close(); pw.focus(); pw.print(); }}} className="w-full">প্রিন্ট করুন</Button>
          </div>
        )}
      </Modal>

      <Modal isOpen={showPrescribeConfirm} onClose={() => setShowPrescribeConfirm(false)} title="প্রেসক্রিব নিশ্চিতকরণ" size="sm">
        <div className="space-y-4">
          <p>আপনি কি রোগী <strong>{prescribePatient?.patient_name}</strong> এর জন্য প্রেসক্রিব পেজে যেতে চান?</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowPrescribeConfirm(false)} className="flex-1">বাতিল</Button>
            <Button onClick={() => { window.open(`https://carescriptrx.vercel.app/dashboard/doctor/prescribe?patient_id=${prescribePatient?.patient_id}`, '_blank'); setShowPrescribeConfirm(false); }} className="flex-1">যেতে চান</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showHistoryModal} onClose={() => { setShowHistoryModal(false); setHistoryStep(-1); }} title="রোগী ইতিহাস" size="xl">
        <div className="space-y-6">
          <p className="font-semibold text-lg">{historyPatient?.patient_name} এর জন্য ইতিহাস ফর্ম</p>
          {historyLoading ? <div className="flex items-center justify-center py-16"><div className="flex flex-col items-center gap-3"><div className="w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" /><span className="text-sm text-slate-400">লোড হচ্ছে...</span></div></div> : historyQuestions.length === 0 ? <p className="text-slate-500">কোনো প্রশ্ন পাওয়া যায়নি</p> : (
            (() => {
              const grouped = historyQuestions.reduce((acc: Record<string, any[]>, q: any) => { const d = q.disease_name || 'সাধারণ'; if(!acc[d]) acc[d]=[]; acc[d].push(q); return acc; }, {});
              const diseaseNames = Object.keys(grouped);
              if (historyStep === -1) return (<div className="grid grid-cols-2 gap-3">{diseaseNames.map((name, idx) => (<button key={name} onClick={() => setHistoryStep(idx)} className="p-5 rounded-xl border-2 border-slate-200 hover:border-primary-400 hover:bg-primary-50 transition-all text-left"><h4 className="font-bold text-primary-700 text-lg">{name}</h4><p className="text-xs text-slate-500 mt-1">{grouped[name].length} টি প্রশ্ন</p></button>))}</div>);
              const currentDisease = diseaseNames[historyStep];
              const currentQuestions = grouped[currentDisease];
              return (<><div className="flex items-center justify-between"><h3 className="text-xl font-bold text-primary-700">{currentDisease}</h3></div><div className="space-y-4">{currentQuestions.map((q: any, qIdx: number) => { const imgKey=`${q.id}_img`; const vidKey=`${q.id}_vid`; const audKey=`${q.id}_aud`; const getFilesArr=(val:string|undefined):string[]=>{if(!val)return[];try{const p=JSON.parse(val);return Array.isArray(p)?p:[val]}catch{return[val]}};const uploadBtn=(label: string, key: string, accept: string, icon: any) => {const files=getFilesArr(historyAnswers[key]);return (<div className="space-y-1">{files.length>0&&<div className="flex flex-wrap gap-2">{files.map((file,idx)=>(<div key={idx} className="relative inline-block group">{accept.startsWith('image')&&<img src={file} alt="" className="max-h-28 rounded-lg object-cover"/>}{accept.startsWith('video')&&<video src={file} controls className="max-h-28 rounded-lg"/>}{accept.startsWith('audio')&&<audio src={file} controls className="h-10"/>}<button type="button" onClick={()=>{const updated=files.filter((_,i)=>i!==idx);setHistoryAnswers((p:any)=>{const a={...p};if(updated.length>0)a[key]=JSON.stringify(updated);else delete a[key];return a})}} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">X</button></div>))}</div>}<button type="button" onClick={()=>{const MAX_FILE_SIZE=50*1024*1024;const input=document.createElement('input');input.type='file';input.accept=accept;input.onchange=(e:any)=>{const file=e.target?.files?.[0];if(!file)return;if(file.size>MAX_FILE_SIZE){toast.error('ফাইলের সাইজ ৫০MB এর বেশি হতে পারবে না');return;}const expectedType=accept.split('/')[0];if(!file.type.startsWith(expectedType+'/')){const tL:{[k:string]:string}={image:'ছবি',video:'ভিডিও',audio:'অডিও'};toast.error(`অনুগ্রহ করে একটি বৈধ ${tL[expectedType]||expectedType} ফাইল নির্বাচন করুন`);return;}const reader=new FileReader();reader.onload=(ev)=>{setHistoryAnswers((p:any)=>{const prev=p[key];let arr:string[]=[];if(prev){try{const parsed=JSON.parse(prev);arr=Array.isArray(parsed)?parsed:[prev]}catch{arr=[prev]}}return{...p,[key]:JSON.stringify([...arr,ev.target?.result as string])}});toast.success('আপলোড সফল')};reader.readAsDataURL(file)};input.click()}} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-xs font-medium">{icon}{label}</button></div>)}; return (<div key={q.id} className="bg-slate-50 rounded-xl p-4 space-y-3"><div className="flex items-start gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">{qIdx+1}</span><div className="flex-1 space-y-3"><label className="text-sm font-semibold text-slate-700">{q.question}</label>
                {q.type === 'multiple_choice' ? (<div className="space-y-2">{(q.options||[]).map((opt: string, oIdx: number) => (<label key={oIdx} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-primary-300 cursor-pointer transition-all has-[:checked]:bg-primary-50 has-[:checked]:border-primary-400"><input type="radio" name={q.id} value={opt} checked={historyAnswers[q.id]===opt} onChange={(e)=>setHistoryAnswers({...historyAnswers,[q.id]:e.target.value})} className="w-4 h-4 text-primary-600 accent-primary-600"/><span className="text-sm text-slate-700">{opt}</span></label>))}</div>)
                : q.type === 'checkboxes' ? (<div className="space-y-2">{(q.options||[]).map((opt: string, oIdx: number) => { const checked=(historyAnswers[q.id]||'').split(',').includes(opt); return (<label key={oIdx} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-primary-300 cursor-pointer transition-all has-[:checked]:bg-primary-50 has-[:checked]:border-primary-400"><input type="checkbox" value={opt} checked={checked} onChange={(e)=>{const c=(historyAnswers[q.id]||'').split(',').filter(Boolean);const u=e.target.checked?[...c,opt]:c.filter((v:string)=>v!==opt);setHistoryAnswers({...historyAnswers,[q.id]:u.join(',')});}} className="w-4 h-4 text-primary-600 rounded accent-primary-600"/><span className="text-sm text-slate-700">{opt}</span></label>);})}</div>)
                : q.type === 'scale' ? (<div className="space-y-3"><div className="flex items-center justify-between gap-1 w-full">{(q.options||[]).map((val: string, oIdx: number) => {const count=(q.options||[]).length;const size=count>7?'w-8 h-8 text-xs':'w-10 h-10 text-sm';return (<button key={oIdx} type="button" onClick={()=>setHistoryAnswers({...historyAnswers,[q.id]:val})} className={`${size} rounded-full font-medium transition-all flex-shrink-0 ${historyAnswers[q.id]===val?'bg-primary-500 text-white shadow-md shadow-primary-500/30 scale-110':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{val}</button>);})}</div>{q.options&&q.options.length>=2&&<div className="flex justify-between text-xs text-slate-400 px-1"><span>{q.options[0]} - {q.options[q.options.length-1]}</span></div>}</div>)
                : q.type === 'date' ? <input type="date" value={historyAnswers[q.id]||''} onChange={(e)=>setHistoryAnswers({...historyAnswers,[q.id]:e.target.value})} className="input w-full"/>
                : q.type === 'time' ? <input type="time" value={historyAnswers[q.id]||''} onChange={(e)=>setHistoryAnswers({...historyAnswers,[q.id]:e.target.value})} className="input w-full"/>
                : q.type === 'dropdown' ? (<select value={historyAnswers[q.id]||''} onChange={(e)=>setHistoryAnswers({...historyAnswers,[q.id]:e.target.value})} className="input w-full"><option value="">নির্বাচন করুন</option>{(q.options||[]).map((opt: string, oIdx: number) => <option key={oIdx} value={opt}>{opt}</option>)}</select>)
                : q.type === 'file_upload' ? (<div className="space-y-2">{q.acceptTypes&&q.acceptTypes.length>0&&<div className="flex flex-wrap gap-1.5 items-center"><span className="text-[11px] text-slate-400 font-medium">গ্রহণযোগ্য:</span>{q.acceptTypes.includes('image')&&<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-600 border border-blue-200">ছবি</span>}{q.acceptTypes.includes('video')&&<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-600 border border-purple-200">ভিডিও</span>}{q.acceptTypes.includes('audio')&&<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">অডিও</span>}</div>}<div className="flex flex-wrap gap-2">{(!q.acceptTypes||q.acceptTypes.length===0||q.acceptTypes.includes('image'))&&uploadBtn('ছবি', imgKey, 'image/*', <Upload className="w-3.5 h-3.5"/>)}{(!q.acceptTypes||q.acceptTypes.length===0||q.acceptTypes.includes('video'))&&uploadBtn('ভিডিও', vidKey, 'video/*', <Video className="w-3.5 h-3.5"/>)}{(!q.acceptTypes||q.acceptTypes.length===0||q.acceptTypes.includes('audio'))&&uploadBtn('অডিও', audKey, 'audio/*', <Upload className="w-3.5 h-3.5"/>)}</div></div>)
                : q.type === 'paragraph' ? <textarea value={historyAnswers[q.id]||''} onChange={(e)=>setHistoryAnswers({...historyAnswers,[q.id]:e.target.value})} className="input w-full min-h-[70px] resize-y" placeholder="লিখুন..."/>
                : <input type="text" value={historyAnswers[q.id]||''} onChange={(e)=>setHistoryAnswers({...historyAnswers,[q.id]:e.target.value})} className="input w-full" placeholder="লিখুন..."/>}
              </div></div></div>);})}</div><div className="flex items-center justify-between pt-4 border-t border-slate-200"><Button variant="secondary" onClick={()=>setHistoryStep(-1)}>রোগ নির্বাচন</Button><Button onClick={submitHistoryAnswers}>সংরক্ষণ করুন</Button></div></>);
            })()
          )}
        </div>
      </Modal>
    </DashboardLayout>
  );
}
