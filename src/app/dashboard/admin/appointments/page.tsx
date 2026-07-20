'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Search, Filter, Check, X, Calendar, Clock, Video, MoreVertical, ChevronLeft, ChevronRight, ChevronDown, CheckCircle, Plus, Zap, FileText, Upload, Printer, Scan, Receipt, Download, Heart } from 'lucide-react';
import VitalsModal from '@/components/prescribe/VitalsModal';
import type { VitalsData } from '@/components/prescribe/VitalsModal';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { BarcodeScannerInput } from '@/components/ui/BarcodeScannerInput';
import { supabase, supabase1, generateSerialNumber, FEE_TYPES, getFeeAmount, numberToWords } from '@/lib/supabase';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { generateAppointmentPDF } from '@/lib/excel-export';
import { setCache, getCache } from '@/lib/cache';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { AppointmentSlip } from '@/components/appointments/AppointmentSlip';
import { generateCashMemoPrint } from '@/components/appointments/CashMemo';
import { sendNotification, requestPushPermission } from '@/lib/notifications';
import { sendSMS, buildConfirmationSMS } from '@/lib/sms';
import DatePicker from '@/components/ui/DatePicker';
import { motion } from 'framer-motion';
import { Modal } from '@/components/ui/Modal';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 100, damping: 15 }
  }
};

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
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterDate, setFilterDate] = useState(getLocalDateString());
  const [filterDoctor, setFilterDoctor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [walkinPatient, setWalkinPatient] = useState({
    name: '',
    phone: '',
    age: 0 as number,
    sex: '' as 'male' | 'female' | 'other',
    doctor_id: '',
    type: 'in-person' as 'in-person' | 'teleconsult',
    date: getLocalDateString(),
    time: '',
    reason: '',
    compliant: '',
    bcode: '',
    fee_type: 'new' as string,
    advance: 0 as number,
  });
  const [creatingWalkin, setCreatingWalkin] = useState(false);
  const [specialTimePower, setSpecialTimePower] = useState(false);
  const [customTime, setCustomTime] = useState('');
  const [schedules, setSchedules] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrAppointment, setQRAppointment] = useState<any>(null);
  const [showInvoiceEditModal, setShowInvoiceEditModal] = useState(false);
  const [editInvoiceApt, setEditInvoiceApt] = useState<any>(null);
  const [editFeeType, setEditFeeType] = useState('new');
  const [editAdvance, setEditAdvance] = useState(0);
  const [savingInvoice, setSavingInvoice] = useState(false);

  // Vitals modal state
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [vitalsAppointment, setVitalsAppointment] = useState<any>(null);
  const [vitalsData, setVitalsData] = useState<Record<string, VitalsData>>({});
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPatient, setHistoryPatient] = useState<any>(null);
  const [historyQuestions, setHistoryQuestions] = useState<any[]>([]);
  const [historyAnswers, setHistoryAnswers] = useState<{[key: string]: string}>({});
  const [historyStep, setHistoryStep] = useState(0);
  const [vitalData, setVitalData] = useState({ pulse: '', bp_systolic: '', bp_diastolic: '', weight: '', height_ft: '', height_in: '', bmi: '', spo2: '', temp: '' });
  const [vitalLoading, setVitalLoading] = useState(false);

  useEffect(() => {
    loadData();

    if (localStorage.getItem('openAppointmentModal') === 'true') {
      localStorage.removeItem('openAppointmentModal');
      setTimeout(() => setShowWalkinModal(true), 500);
    }
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
    if (walkinPatient.doctor_id && walkinPatient.date) {
      loadDoctorSchedules();
    }
  }, [walkinPatient.doctor_id, walkinPatient.date, specialTimePower, customTime]);

  async function loadDoctorSchedules() {
    if (specialTimePower) {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;
      setAvailableSlots([currentTime]);
      setSchedules([{ id: 'custom', start_time: currentTime, end_time: currentTime }]);
      return;
    }

    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('doctor_id', walkinPatient.doctor_id)
      .lte('start_date', walkinPatient.date) // start_date <= date
      .or(`end_date.is.null,end_date.gte.${walkinPatient.date}`) // end_date >= date OR end_date is null
      .order('start_time');

    if (data && data.length > 0) {
      // Filter by weekday
      const dayMapping: { [key: number]: string } = {
        0: 'রবিবার',
        1: 'সোমবার',
        2: 'মঙ্গলবার',
        3: 'বুধবার',
        4: 'বৃহস্পতিবার',
        5: 'শুক্রবার',
        6: 'শনিবার',
      };

      const selectedDateObj = new Date(walkinPatient.date);
      const dayOfWeek = selectedDateObj.getDay();
      const dayName = dayMapping[dayOfWeek];

      const matchingSchedules = data.filter((s: any) => 
        s.selected_days?.includes(dayName)
      );

      setSchedules(matchingSchedules);
      const ranges: string[] = [];
      matchingSchedules.forEach((schedule: any) => {
        ranges.push(`${schedule.start_time?.substring(0, 5)} - ${schedule.end_time?.substring(0, 5)}`);
      });
      setAvailableSlots(ranges);
    } else {
      setSchedules([]);
      setAvailableSlots([]);
    }
  }

  async function loadData(useCache = true) {
    const today = getLocalDateString();

    // Try cache first
    if (useCache) {
      const cached = getCache<any[]>('admin_appointments');
      if (cached) {
        setAppointments(cached);
      }
      const cachedDocs = getCache<any[]>('admin_doctors');
      if (cachedDocs) {
        setDoctors(cachedDocs);
      }
    }

    // Fetch fresh data
    const { data: apts, error: aptError } = await supabase
      .from('appointments')
      .select('*, doctors(name, specialization), patients(name, phone, age, sex)')
      .order('created_at', { ascending: true })
      .limit(100);

    if (aptError) {
      console.error('Error fetching appointments:', aptError);
      toast.error('অ্যাপয়েন্টমেন্ট লোড করতে সমস্যা হয়েছে');
    }

    if (apts) {
      // Fetch all active schedules to resolve schedule start time for doctors on the appointment dates
      let scheduleData: any[] = [];
      try {
        const { data } = await supabase
          .from('schedules')
          .select('doctor_id, start_time, end_time, selected_days, start_date, end_date, date')
          .eq('status', 'active');
        if (data) scheduleData = data;
      } catch (e) {
        console.error('Error prefetching schedules:', e);
      }

      const mapped = apts.map((apt: any) => {
        const schedule = apt.schedules?.[0];
        let scheduleStart: string | null = null;
        if (scheduleData.length > 0) {
          const doctorSchedules = scheduleData.filter((s: any) => s.doctor_id === apt.doctor_id);
          let match: any = null;
          const oldMatch = doctorSchedules.find((s: any) => s.date === apt.date);
          if (oldMatch) {
            match = oldMatch;
          } else {
            const dayMap: Record<number, string> = { 0: 'রবিবার', 1: 'সোমবার', 2: 'মঙ্গলবার', 3: 'বুধবার', 4: 'বৃহস্পতিবার', 5: 'শুক্রবার', 6: 'শনিবার' };
            const aptDate = new Date(apt.date + 'T00:00:00');
            const dayName = dayMap[aptDate.getDay()];
            const dayMatch = doctorSchedules.find((s: any) => {
              if (!s.selected_days?.includes(dayName)) return false;
              const startOk = s.start_date ? new Date(s.start_date + 'T00:00:00') <= aptDate : true;
              const endOk = s.end_date ? new Date(s.end_date + 'T00:00:00') >= aptDate : true;
              return startOk && endOk;
            });
            if (dayMatch) match = dayMatch;
          }
          if (match && match.start_time) {
            scheduleStart = match.start_time.substring(0, 5);
          }
        }

        return {
          ...apt,
          doctorName: apt.doctors?.name || '-',
          departmentName: apt.doctors?.specialization || apt.doctors?.department || 'General',
          patientName: apt.patients?.name || '-',
          patientPhone: apt.patients?.phone || '',
          patientAge: apt.patients?.age || apt.age || '-',
          patientGender: apt.patients?.sex || apt.gender || '-',
          fee_type: apt.fee_type || 'new',
          start_time: schedule?.start_time || null,
          end_time: schedule?.end_time || null,
          scheduleStart,
          displayStatus: apt.status === 'pending' ? 'pending' :
            apt.status === 'confirmed' ? 'confirmed' :
              apt.status === 'cancelled' ? 'cancelled' :
                apt.status === 'completed' ? 'completed' :
                  getStatusFromDate(apt.date),
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
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      setAppointments(sorted);
      setCache('admin_appointments', sorted);

      const vitalsMap: Record<string, VitalsData> = {};
      for (const apt of sorted) {
        if (apt.vitals) vitalsMap[apt.id] = apt.vitals;
      }
      setVitalsData(vitalsMap);
    }

    const { data: docs } = await supabase.from('doctors').select('*').eq('is_available', true).order('name');
    if (docs) {
      setDoctors(docs);
      setCache('admin_doctors', docs);
    }

    setLoading(false);
  }

  const getStatusFromDate = (dateStr: string) => {
    const appointmentDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (appointmentDate < today) return 'completed';
    return 'upcoming';
  };

  function getExpectedTimes(list: any[]) {
    const groups: Record<string, any[]> = {};
    list.forEach(apt => {
      const key = `${apt.doctor_id}_${apt.date}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(apt);
    });
    const times: Record<string, string> = {};
    Object.values(groups).forEach((group: any[]) => {
      const sorted = [...group].sort((a, b) => {
        if (a.serial_number && b.serial_number) return a.serial_number.localeCompare(b.serial_number);
        return (a.created_at || '').localeCompare(b.created_at || '');
      });
      const baseScheduleStart = sorted.find(a => a.scheduleStart)?.scheduleStart;
      const firstTime = (baseScheduleStart || sorted[0]?.time || '09:00').split(' - ')[0].split(':').map(Number);
      const baseHours = firstTime[0] || 9;
      const baseMinutes = firstTime[1] || 0;
      sorted.forEach((apt, idx) => {
        const totalMin = baseHours * 60 + baseMinutes + idx * 5;
        const h = Math.floor(totalMin / 60) % 24;
        const m = totalMin % 60;
        const period = h >= 12 ? 'PM' : 'AM';
        const disp = h % 12 || 12;
        times[apt.id] = `${String(disp).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
      });
    });
    return times;
  }

  const filteredAppointments = appointments.filter(apt => {
    if (filterDate && apt.date !== filterDate) return false;
    if (filterDoctor && apt.doctor_id !== filterDoctor) return false;
    if (filterStatus && apt.status !== filterStatus && apt.displayStatus !== filterStatus) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      const patientMatch = apt.patientName?.toLowerCase().includes(searchLower);
      const doctorMatch = apt.doctorName?.toLowerCase().includes(searchLower);
      if (!patientMatch && !doctorMatch) return false;
    }
    return true;
  });

  const expectedTimes = getExpectedTimes(filteredAppointments);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  function handleExportPDF() {
    const today = new Date();
    const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
    generateAppointmentPDF({
      title: `Micare Health - Appointment Report`,
      date: dateStr,
      appointments: filteredAppointments.map((apt, idx) => {
        const serialSuffix = apt.serial_number?.slice(-1) || '';
        const feeTypeMap: Record<string, string> = { N: 'New Patient', F: 'Follow Up', R: 'Report Showing' };
        const feeTypeLabel = feeTypeMap[serialSuffix] || FEE_TYPES.find(f => f.value === apt.fee_type)?.label || apt.fee_type || 'New Patient';
        return {
          serial: apt.serial_number || '-',
          patientName: apt.patientName || 'রোগী',
          phone: apt.patientPhone || apt.patients?.phone || '',
          age: apt.patientAge || apt.patients?.age || '-',
          gender: apt.patientGender === 'male' ? 'Male' : apt.patientGender === 'female' ? 'Female' : apt.patientGender || '-',
          doctor: apt.doctorName || '-',
          department: apt.departmentName || 'General',
          type: apt.type === 'teleconsult' ? 'Teleconsult' : 'In-Person',
          status: apt.displayStatus === 'confirmed' ? 'Confirmed' : apt.displayStatus === 'completed' ? 'Completed' : apt.displayStatus === 'pending' ? 'Pending' : apt.displayStatus === 'cancelled' ? 'Cancelled' : apt.displayStatus || '-',
          time: apt.time || '-',
          date: apt.date || '-',
          feeType: feeTypeLabel,
          advance: apt.advance || 0,
        };
      }),
    });
  }

  const formatTime = (timeStr: string) => timeStr ? timeStr.substring(0, 5) : '';

  const handleApprove = async (apt: any, currentStatus: string) => {
    let newStatus: string;

    if (currentStatus === 'pending') {
      newStatus = 'confirmed';
    } else if (currentStatus === 'confirmed') {
      newStatus = 'pending';
    } else if (currentStatus === 'cancelled') {
      newStatus = 'confirmed';
    } else {
      newStatus = 'confirmed';
    }

    if (!apt || !apt.id) {
      console.error('No appointment data:', apt);
      toast.error('অ্যাপয়েন্টমেন্ট খুঁজে পাওয়া যায়নি');
      return;
    }

    let updateData: any = { status: newStatus };

    if ((newStatus === 'confirmed' || newStatus === 'completed') && !apt.serial_number) {
      const serialNumber = await generateSerialNumber(
        apt.doctor_id,
        apt.date,
        apt.type === 'teleconsult' ? 'teleconsult' : 'appointment',
        apt.fee_type
      );
      updateData.serial_number = serialNumber;
    }

    const { error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', apt.id);

    if (error) {
      console.error('Status update error:', error);
      toast.error('স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে');
    } else {
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
            doctorId: apt.doctor_id,
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
              apt.scheduleStart || apt.time || '',
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

          try {
            await sendNotification('teleconsult_ready_doctor', {
              doctorId: apt.doctor_id,
            }, {
              patientName: apt.patients?.name,
            });
          } catch (e) {}
        }
      }

      toast.success(newStatus === 'confirmed' ? 'নিশ্চিত হয়েছে' : 'অপেক্ষায় সেট করা হয়েছে');
      loadData();
    }
  };

  const handleReject = async (apt: any) => {
    if (!apt || !apt.id) {
      toast.error('অ্যাপয়েন্টমেন্ট খুঁজে পাওয়া যায়নি');
      return;
    }

    if (!confirm('এই অ্যাপয়েন্টমেন্ট বাতিল করতে চান?')) return;

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', apt.id);

    if (!error) {
      toast.success('অ্যাপয়েন্টমেন্ট বাতিল হয়েছে');
      loadData();
    }
  };

  const handleCancelAppointment = async (id: string) => {
    if (!confirm('এই অ্যাপয়েন্টমেন্ট বাতিল করতে চান?')) return;

    const { data: apt } = await supabase
      .from('appointments')
      .select('*, patients(name), doctors(name)')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (!error && apt) {
      requestPushPermission();

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
            doctorId: apt.doctor_id,
          }, {
            patientName: apt.patients?.name,
          });
        } catch (e) {}
      } else {
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
            doctorId: apt.doctor_id,
          }, {
            patientName: apt.patients?.name,
          });
        } catch (e) {}
      }

      try {
        await sendNotification('appointment_cancelled_admin', {
          adminIds: [],
        }, {
          patientName: apt.patients?.name,
          doctorName: apt.doctors?.name,
        });
      } catch (e) {}

      toast.success('অ্যাপয়েন্টমেন্ট বাতিল হয়েছে');
      loadData();
    }
  };

  const handleBarcodePatient = useCallback((patient: any) => {
    if (patient?.name) {
      setSearch(patient.name);
      toast.success(`${patient.name} এর ফলাফল দেখানো হয়েছে`);
    }
  }, []);

  const handleBarcodeClear = useCallback(() => {
    setSearch('');
  }, []);

  useBarcodeScanner({
    onScan: async (code) => {
      const { supabase } = await import('@/lib/supabase');
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('bcode', code)
        .maybeSingle();
      if (patient) {
        window.open(`https://carescriptrx.vercel.app/dashboard/doctor/prescribe?patient_id=${patient.id}&source=micare`, '_blank');
      } else {
        toast.error('কোনো রোগী খুঁজে পাওয়া যায়নি');
      }
    },
  });

  const handleComplete = async (apt: any) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'completed' })
      .eq('id', apt.id);

    if (!error) {
      await supabase
        .from('patients')
        .update({ status: 'completed' })
        .eq('id', apt.patient_id);

      toast.success('অ্যাপয়েন্টমেন্ট সম্পন্ন হয়েছে');
      loadData();
    }
  };

  const handleAddWalkin = async () => {
    if (!walkinPatient.name || !walkinPatient.doctor_id) {
      toast.error('রোগীর নাম ও ডাক্তার নির্বাচন করুন');
      return;
    }

    setCreatingWalkin(true);

try {
      const getCurrentTime = () => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      };
      const appointmentTime = specialTimePower
        ? getCurrentTime()
        : (walkinPatient.time ? walkinPatient.time.split(' - ')[0] : '09:00');
      const type = walkinPatient.type === 'teleconsult' ? 'teleconsult' : 'appointment';
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const [patientResult, serialNumber] = await Promise.all([
        supabase.from('patients').insert({
          name: walkinPatient.name,
          phone: walkinPatient.phone || '',
          email: `walkin_${uniqueSuffix}@clinicconnect.local`,
          password: 'walkin_temp',
          age: walkinPatient.age,
          sex: walkinPatient.sex || 'male',
          compliant: walkinPatient.compliant || 'false',
        }).select('id').single(),
        generateSerialNumber(walkinPatient.doctor_id, walkinPatient.date, type, walkinPatient.fee_type)
      ]);

      const newPatient = patientResult.data;
      if (patientResult.error || !newPatient) {
        toast.error(`রোগী তৈরি করতে ব্যর্থ: ${patientResult.error?.message || 'Unknown error'}`);
        setCreatingWalkin(false);
        return;
      }

      const { error: aptError } = await supabase.from('appointments').insert({
        patient_id: newPatient.id,
        doctor_id: walkinPatient.doctor_id,
        date: walkinPatient.date,
        time: appointmentTime,
        status: 'confirmed',
        type: walkinPatient.type,
        reason: walkinPatient.reason || null,
        serial_number: serialNumber,
        patient_mobile: walkinPatient.phone || '',
        fee_type: walkinPatient.fee_type,
        advance: walkinPatient.advance,
      });

      if (aptError) {
        toast.error(`অ্যাপয়েন্টমেন্ট তৈরি করতে ব্যর্থ: ${aptError.message}`);
        setCreatingWalkin(false);
        return;
      }

      const walkinDoctor = doctors.find(d => d.id === walkinPatient.doctor_id);

      const [scheduleResult] = await Promise.all([
        supabase.from('schedules')
          .select('start_time, selected_days, start_date, end_date, date')
          .eq('doctor_id', walkinPatient.doctor_id)
          .eq('status', 'active'),
        !walkinPatient.bcode
          ? fetch(`/api/gen-bcode?patient_id=${newPatient.id}`).then(r => r.json()).then(d => { if (d.code) walkinPatient.bcode = d.code; }).catch(() => {})
          : Promise.resolve()
      ]);

      let scheduleStart = null;
      const scheduleData = scheduleResult.data;
      if (scheduleData && scheduleData.length > 0) {
        let match: any = null;
        const oldMatch = scheduleData.find((s: any) => s.date === walkinPatient.date);
        if (oldMatch) {
          match = oldMatch;
        } else {
          const dayMap: Record<number, string> = { 0: 'রবিবার', 1: 'সোমবার', 2: 'মঙ্গলবার', 3: 'বুধবার', 4: 'বৃহস্পতিবার', 5: 'শুক্রবার', 6: 'শনিবার' };
          const aptDate = new Date(walkinPatient.date + 'T00:00:00');
          const dayName = dayMap[aptDate.getDay()];
          const dayMatch = scheduleData.find((s: any) => {
            if (!s.selected_days?.includes(dayName)) return false;
            const startOk = s.start_date ? new Date(s.start_date + 'T00:00:00') <= aptDate : true;
            const endOk = s.end_date ? new Date(s.end_date + 'T00:00:00') >= aptDate : true;
            return startOk && endOk;
          });
          if (dayMatch) match = dayMatch;
        }
        if (match && match.start_time) {
          scheduleStart = match.start_time.substring(0, 5);
        }
      }

      toast.success('অ্যাপয়েন্টমেন্ট যোগ হয়েছে');
      setQRAppointment({
        id: '',
        patient_id: newPatient.id,
        patients: {
          name: walkinPatient.name,
          phone: walkinPatient.phone,
          id: newPatient.id,
          sex: walkinPatient.sex || '',
          age: walkinPatient.age || '',
          bcode: walkinPatient.bcode || '',
        },
        doctors: {
          name: walkinDoctor?.name || '',
          degree: walkinDoctor?.degree || '',
          specialty: walkinDoctor?.specialty || '',
        },
        serial_number: serialNumber,
        date: walkinPatient.date,
        time: appointmentTime,
        scheduleStart,
      });
      setShowQRModal(true);

      if (walkinPatient.phone) {
        try {
          const smsText = buildConfirmationSMS(
            walkinDoctor?.name || '',
            walkinPatient.date,
            scheduleStart || appointmentTime,
            serialNumber || ''
          );
          await sendSMS(walkinPatient.phone, smsText);
        } catch (e) {
          console.error('Walkin SMS error:', e);
        }
      }
      setShowWalkinModal(false);
      setWalkinPatient({ name: '', phone: '', age: 0, sex: 'male', doctor_id: '', type: 'in-person', date: getLocalDateString(), time: '', reason: '', compliant: '', bcode: '', fee_type: 'new', advance: 0 });
      setSpecialTimePower(false);
      setCustomTime('');
      loadData();
    } catch (err) {
      toast.error('কিছু সমস্যা হয়েছে');
    } finally {
      setCreatingWalkin(false);
    }
  };

  const getStatusBadge = (status: string, displayStatus: string) => {
    if (displayStatus === 'upcoming' || displayStatus === 'pending') {
      if (status === 'pending') {
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">অপেক্ষায়</span>;
      } else if (status === 'confirmed') {
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">নিশ্চিত</span>;
      }
    }
    return <StatusPill status={displayStatus as any} />;
  };

  const handlePrescribe = async (apt: any) => {
    const patientData = {
      name: apt.patients?.name || '',
      age: apt.patients?.age || '',
      gender: apt.patients?.sex || 'male',
      weight: '',
      phone: apt.patients?.phone || '',
      vitals: vitalsData[apt.id] || apt.vitals || null,
    };
    sessionStorage.setItem(`careRx_patient_data_${apt.patient_id}`, JSON.stringify(patientData));
    window.open(`https://carescriptrx.vercel.app/dashboard/doctor/prescribe?patient_id=${apt.patient_id}&source=micare`, '_blank');
  };

  const handleVitals = (apt: any) => {
    setVitalsAppointment(apt);
    setShowVitalsModal(true);
  };

  const handleSaveVitals = async (vitals: VitalsData) => {
    if (!vitalsAppointment) return;
    try {
      await fetch('/api/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: vitalsAppointment.id, vitals }),
      });
      setVitalsData(prev => ({ ...prev, [vitalsAppointment.id]: vitals }));
      toast.success('ভাইটালস সংরক্ষিত হয়েছে');
    } catch (err: any) {
      toast.error('ভাইটালস সংরক্ষণ ব্যর্থ');
    }
  };

  const handleHistory = async (apt: any) => {
    setHistoryPatient({
      patient_id: apt.patient_id,
      patient_name: apt.patientName,
      appointment_id: apt.id,
    });
    setHistoryAnswers({});
    setHistoryStep(-1);
    setVitalData({ pulse: '', bp_systolic: '', bp_diastolic: '', weight: '', height_ft: '', height_in: '', bmi: '', spo2: '', temp: '' });
    const { data: existingVitals } = await supabase
      .from('patient_history').select('*').eq('patient_id', apt.patient_id).eq('disease_name', 'ভাইটালস');
    if (existingVitals && existingVitals.length > 0) {
      const vMap: Record<string, string> = {};
      existingVitals.forEach((v: any) => { vMap[v.question_id] = v.answer; });
      const hCm = parseFloat(vMap['vital_height'] || '');
      const hFt = hCm ? Math.floor(hCm / 2.54 / 12).toString() : '';
      const hIn = hCm ? Math.round((hCm / 2.54) % 12).toString() : '';
      setVitalData({
        pulse: vMap['vital_pulse'] || '',
        bp_systolic: vMap['vital_bp_systolic'] || '',
        bp_diastolic: vMap['vital_bp_diastolic'] || '',
        weight: vMap['vital_weight'] || '',
        height_ft: hFt,
        height_in: hIn,
        bmi: vMap['vital_bmi'] || '',
        spo2: vMap['vital_spo2'] || '',
        temp: vMap['vital_temp'] || '',
      });
    }

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

    await supabase
      .from('patient_history')
      .delete()
      .eq('patient_id', historyPatient.patient_id);

    const answersToInsert = Object.entries(historyAnswers).map(([question_id, answer]) => {
      const baseId = question_id.replace(/_(img|vid|aud)$/, '');
      const q = historyQuestions.find((hq: any) => hq.id === baseId);
      return {
        patient_id: historyPatient.patient_id,
        question_id,
        disease_name: q?.disease_name || '',
        question: q?.question || '',
        answer,
      };
    });

    if (answersToInsert.length === 0) {
      toast.dismiss(loadingToast);
      toast.success('ইতিহাস সংরক্ষিত হয়েছে');
      setShowHistoryModal(false);
      return;
    }

    const { error } = await supabase
      .from('patient_history')
      .insert(answersToInsert);

    toast.dismiss(loadingToast);
    if (!error) {
      toast.success('ইতিহাস সংরক্ষিত হয়েছে');
      setShowHistoryModal(false);
    } else {
      toast.error('ইতিহাস সংরক্ষণে সমস্যা হয়েছে');
    }
  };

  const saveVitals = async () => {
    if (!historyPatient) return;
    const wt = parseFloat(vitalData.weight);
    const ft = parseFloat(vitalData.height_ft) || 0;
    const inch = parseFloat(vitalData.height_in) || 0;
    const htCm = (ft * 12 + inch) * 2.54;
    const bmi = (wt > 0 && htCm > 0) ? parseFloat((wt / ((htCm / 100) * (htCm / 100))).toFixed(1)) : null;

    const vitalEntries = [
      { id: 'vital_pulse', question: 'পালস (Pulse)', value: vitalData.pulse },
      { id: 'vital_bp_systolic', question: 'BP (Systolic)', value: vitalData.bp_systolic },
      { id: 'vital_bp_diastolic', question: 'BP (Diastolic)', value: vitalData.bp_diastolic },
      { id: 'vital_weight', question: 'ওজন (kg)', value: vitalData.weight },
      { id: 'vital_height', question: 'উচ্চতা (cm)', value: htCm > 0 ? htCm.toFixed(1) : '' },
      { id: 'vital_bmi', question: 'BMI', value: bmi?.toString() || '' },
      { id: 'vital_spo2', question: 'SpO2 (%)', value: vitalData.spo2 },
      { id: 'vital_temp', question: 'তাপমাত্রা (°C)', value: vitalData.temp },
    ].filter(e => e.value);

    if (vitalEntries.length === 0) { toast.error('অন্তত একটি ভাইটালস পূরণ করুন'); return; }

    const loadingToast = toast.loading('ভাইটালস সংরক্ষণ করা হচ্ছে...');

    await supabase.from('patient_history').delete()
      .eq('patient_id', historyPatient.patient_id).eq('disease_name', 'ভাইটালস');

    const rows = vitalEntries.map(e => ({
      patient_id: historyPatient.patient_id,
      question_id: e.id,
      disease_name: 'ভাইটালস',
      question: e.question,
      answer: e.value,
    }));

    const { error } = await supabase.from('patient_history').insert(rows);
    toast.dismiss(loadingToast);
    if (!error) { toast.success('ভাইটালস সংরক্ষিত হয়েছে'); setShowHistoryModal(false); }
    else { console.error(error); toast.error('ভাইটালস সংরক্ষণে সমস্যা হয়েছে'); }
  };

  const handlePrintSlip = async (apt: any) => {
    if (!apt) return;

    let bcode = apt.patients?.bcode || '';
    if (!bcode && apt.patient_id) {
      try {
        const r = await fetch(`/api/gen-bcode?patient_id=${apt.patient_id}`);
        const d = await r.json();
        if (d.code) bcode = d.code;
      } catch {}
    }

    const pw = window.open('', '_blank');
    if (!pw) return;

    const pName = (apt.patients?.name || '').replace(/[<>]/g, '');
    const pGender = (apt.patients?.sex || '').replace(/[<>]/g, '');
    const pAge = apt.patients?.age ?? '';
    const pPhone = (apt.patients?.phone || '-').replace(/[<>]/g, '');
    const dName = (apt.doctors?.name || '').replace(/[<>]/g, '');
    const dDegree = (apt.doctors?.degree || '').replace(/[<>]/g, '');
    const dDesignation = (apt.doctors?.designation || '').replace(/[<>]/g, '');
    const dSpecialty = (apt.doctors?.specialty || apt.doctors?.specialization || '').replace(/[<>]/g, '');
    const dCreds = [dDegree, dDesignation, dSpecialty].filter(Boolean).join(', ');
    const pSerial = apt.serial_number || null;
    const pSerialDisplay = pSerial || '-';
    pw.document.write(`<html><head><title>Appointment Slip</title><script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"><\/script><style>@page{size:4.13in 2.17in;margin:2mm}body{font-family:sans-serif;padding:6px;max-width:100%;margin:0 auto;font-size:8px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px}.details{margin-bottom:4px}.details div{margin-bottom:1px;font-size:8px}.label{font-weight:600;color:#555;display:inline-block;width:65px;font-size:8px}.consultant{border-top:1px solid #e2e8f0;padding-top:3px;font-size:8px}.consultant .info{display:inline-block;vertical-align:top}.consultant .name{font-weight:500}.consultant .degree{font-size:7px;color:#666;word-break:break-word;white-space:pre-line}img.logo{height:22px;width:auto}@media print{body{padding:3px}}</style></head><body><div class="header"><div><svg id="barcode"></svg></div><img src="https://iili.io/Cf3Yo8b.png" class="logo" /></div><div class="details"><div><span class="label">Patient Serial:</span>${pSerialDisplay}</div><div><span class="label">Patient Name:</span>${pName}</div><div><span class="label">Gender:</span>${pGender.charAt(0).toUpperCase() + pGender.slice(1)}<span style="margin-left:50px;font-weight:600;color:#555;">Age:</span> ${pAge}</div><div><span class="label">Phone:</span>${pPhone}</div></div><div class="consultant"><span class="label" style="vertical-align:top;">Consultant:</span><div class="info"><div class="name">${dName}</div>${dCreds ? `<div class="degree">${dCreds}</div>` : ''}</div></div><script>${bcode ? `JsBarcode("#barcode","${bcode}",{format:"CODE128",width:1.5,height:50,displayValue:false,margin:5});` : ''}setTimeout(function(){window.print()},500);<\/script></body></html>`);
    pw.document.close();
  };

  const handlePrintSlipFromTable = async (apt: any) => {
    const { data } = await supabase
      .from('appointments')
      .select('*, patients(*), doctors(*)')
      .eq('id', apt.id)
      .single();
    if (data) handlePrintSlip(data);
  };

  const handlePrintInvoice = async (apt: any) => {
    let bcode = apt.patients?.bcode || '';
    if (!bcode && apt.patient_id) {
      try {
        const r = await fetch(`/api/gen-bcode?patient_id=${apt.patient_id}`);
        const d = await r.json();
        if (d.code) bcode = d.code;
      } catch {}
    }

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB');
    const billNo = `INV-${apt.serial_number || apt.id?.substring(0, 8) || '0000'}-${today.getTime().toString().slice(-4)}`;
    const feeAmt = getFeeAmount(apt.fee_type);
    const feeLabel = FEE_TYPES.find(f => f.value === apt.fee_type)?.label || 'Consultation';
    const advancePaid = apt.advance || 0;
    const dueAmt = feeAmt - advancePaid;

    generateCashMemoPrint({
      billNo,
      date: dateStr,
      appNo: apt.serial_number || '-',
      hn: apt.patient_id?.substring(0, 8) || '-',
      barcode: bcode,
      patientName: apt.patients?.name || apt.patientName || '',
      patientAge: apt.patients?.age ?? '',
      patientGender: apt.patients?.sex || '',
      patientMobile: apt.patients?.phone || apt.patient_mobile || '',
      patientAddress: '',
      conType: apt.type === 'teleconsult' ? 'Teleconsultation' : 'In-person Visit',
      department: apt.specialization || 'General',
      consultant: apt.doctors?.name || apt.doctorName || '',
      services: [
        { name: `${feeLabel} Fee (${apt.doctors?.name || apt.doctorName || 'Doctor'})`, amount: feeAmt },
      ],
      subTotal: feeAmt,
      netPayable: feeAmt,
      advance: advancePaid,
      due: dueAmt,
      inWords: numberToWords(dueAmt),
      isPaid: dueAmt <= 0,
      paymentLog: [
        {
          paymentType: feeLabel,
          collectedBy: 'Admin',
          date: dateStr,
          mode: 'Cash',
          amount: feeAmt,
        },
      ],
    });
  };

  const handleSaveInvoice = async (shouldPrint: boolean) => {
    if (!editInvoiceApt) return;
    setSavingInvoice(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ fee_type: editFeeType, advance: editAdvance })
        .eq('id', editInvoiceApt.id);
      if (error) throw error;

      const updatedApt = { ...editInvoiceApt, fee_type: editFeeType, advance: editAdvance };
      setAppointments(prev => prev.map(a => a.id === updatedApt.id ? updatedApt : a));

      setShowInvoiceEditModal(false);
      setEditInvoiceApt(null);

      if (shouldPrint) {
        handlePrintInvoice(updatedApt);
      }
    } catch (err) {
      console.error('Save invoice error:', err);
    } finally {
      setSavingInvoice(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 page-enter"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">অ্যাপয়েন্টমেন্ট</h1>
            <p className="text-slate-500 mt-1">সকল অ্যাপয়েন্টমেন্ট দেখুন ও পরিচালনা করুন</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleExportPDF}><Download className="w-5 h-5" /> PDF</Button>
            <Button onClick={() => setShowWalkinModal(true)}>
              <Plus className="w-5 h-5" /> নতুন অ্যাপয়েন্টমেন্ট
            </Button>
          </div>
        </div>

        <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-lg shadow-slate-200/20">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="min-w-[160px]">
              <label className="text-sm font-medium text-slate-600 mb-2 block">তারিখ</label>
              <DatePicker
                value={filterDate}
                onChange={setFilterDate}
                className="!w-full"
              />
            </div>

            <div className="min-w-[160px]">
              <label className="text-sm font-medium text-slate-600 mb-2 block">ডাক্তার</label>
              <select
                value={filterDoctor}
                onChange={(e) => setFilterDoctor(e.target.value)}
                className="input"
              >
                <option value="">সব ডাক্তার</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="min-w-[160px]">
              <label className="text-sm font-medium text-slate-600 mb-2 block">স্ট্যাটাস</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input"
              >
                <option value="">সব স্ট্যাটাস</option>
                <option value="pending">অপেক্ষায়</option>
                <option value="confirmed">নিশ্চিত</option>
                <option value="completed">সম্পন্ন</option>
                <option value="cancelled">বাতিল</option>
              </select>
            </div>

            <div className="flex-1 min-w-[150px] sm:min-w-[200px]">
              <label className="text-sm font-medium text-slate-600 mb-2 block">খুঁজুন</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="রোগী/ডাক্তার..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div className="min-w-[160px] sm:min-w-[200px]">
              <label className="text-sm font-medium text-slate-600 mb-2 block">
                <span className="flex items-center gap-1.5">
                  <Scan className="w-4 h-4" />
                  বারকোড স্ক্যান
                </span>
              </label>
              <BarcodeScannerInput
                onPatientFound={handleBarcodePatient}
                onClear={handleBarcodeClear}
                placeholder="বারকোড স্ক্যান করুন..."
              />
            </div>
          </div>
        </Card>

        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  {/* <th className="px-4 py-3 text-left font-semibold text-slate-600">No.</th> */}
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 ">সিরিয়াল</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">রোগী</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">মোবাইল নম্বর</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">ডাক্তার</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">তারিখ</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">প্রত্যাশিত সময়</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">ধরন</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">স্ট্যাটাস</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">সম্পন্ন</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600"></th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Calendar className="w-7 h-7 text-slate-400" />
                      </div>
                      <p className="text-slate-500">নির্বাচিত তারিখে কোনো অ্যাপয়েন্টমেন্ট নেই</p>
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((apt, index) => (
                    <motion.tr
                      key={apt.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-slate-400 font-mono text-xs mr-2">
                          {index + 1}
                        </span>
                        <span className="text-slate-600 font-mono">{(apt.status === 'confirmed' || apt.status === 'completed') && apt.serial_number ? apt.serial_number : '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">{apt.patientName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-500">{apt.patient_mobile || apt.patients?.phone || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-slate-900">{apt.doctorName}</span>
                          <p className="text-xs text-slate-500">{apt.specialization}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-600">{formatDate(apt.date)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-semibold text-primary-600">{expectedTimes[apt.id] || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs ${apt.type === 'teleconsult' ? 'text-purple-600' : 'text-slate-600'}`}>
                          {apt.type === 'teleconsult' && <Video className="w-3 h-3" />}
                          {apt.type === 'teleconsult' ? 'ভিডিও' : 'সরাসরি'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(apt.status, apt.displayStatus)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {apt.status !== 'completed' && apt.status !== 'cancelled' ? (
                          <button
                            onClick={() => handleComplete(apt)}
                            className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="সম্পন্ন করুন"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                        ) : (
                          <div className="flex justify-center">
                            <CheckCircle className="w-5 h-5 text-emerald-400 opacity-50" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
{apt.status !== 'completed' && (
                             <>
                               {apt.status === 'pending' && (
                                 <>
                                   <button
                                     onClick={() => handleApprove(apt, apt.status)}
                                     className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                                     title="নিশ্চিত করুন"
                                   >
                                     <Check className="w-4 h-4" />
                                   </button>
                                   <button
                                     onClick={() => handleReject(apt)}
                                     className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                     title="বাতিল করুন"
                                   >
                                     <X className="w-4 h-4" />
                                   </button>
                                 </>
                               )}
                               {apt.status === 'confirmed' && (
                                 <button
                                   onClick={() => handleApprove(apt, apt.status)}
                                   className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                                   title="অপেক্ষায় করুন"
                                 >
                                   <Clock className="w-4 h-4" />
                                 </button>
                               )}
                               {apt.status === 'cancelled' && (
                                 <button
                                   onClick={() => handleApprove(apt, apt.status)}
                                   className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                                   title="পুনরুদ্ধার করুন"
                                 >
                                   <Check className="w-4 h-4" />
                                 </button>
                               )}
                                <button
                                  onClick={() => handlePrescribe(apt)}
                                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="প্রেসক্রিব"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleVitals(apt)}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="ভাইটালস"
                                >
                                  <Heart className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleHistory(apt)}
                                  className="p-2 text-purple-500 hover:bg-purple-50 rounded-lg transition-colors"
                                  title="ইতিহাস"
                                >
                                  <FileText className="w-4 h-4" />
                                 </button>
                                 <button
                                   onClick={() => handlePrintSlipFromTable(apt)}
                                   className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                                   title="স্লিপ প্রিন্ট"
                                 >
                                   <Printer className="w-4 h-4" />
                                 </button>
                                 <button
                                   onClick={() => { setEditInvoiceApt(apt); setEditFeeType(apt.fee_type || 'new'); setEditAdvance(apt.advance || 0); setShowInvoiceEditModal(true); }}
                                   className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                                   title="ইনভয়েস"
                                 >
                                   <Receipt className="w-4 h-4" />
                                 </button>
                               </>
                             )}
                             {apt.status === 'completed' && (
                               <div className="flex items-center justify-end gap-1">
                                 <button
                                   onClick={() => handlePrescribe(apt)}
                                   className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                   title="প্রেসক্রিব"
                                 >
                                   <FileText className="w-4 h-4" />
                                 </button>
                                 <button
                                   onClick={() => handleVitals(apt)}
                                   className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                   title="ভাইটালস"
                                 >
                                   <Heart className="w-4 h-4" />
                                 </button>
                                <button
                                  onClick={() => handleHistory(apt)}
                                  className="p-2 text-purple-500 hover:bg-purple-50 rounded-lg transition-colors"
                                  title="ইতিহাস"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handlePrintSlipFromTable(apt)}
                                  className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                                  title="স্লিপ প্রিন্ট"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => { setEditInvoiceApt(apt); setEditFeeType(apt.fee_type || 'new'); setEditAdvance(apt.advance || 0); setShowInvoiceEditModal(true); }}
                                  className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="ইনভয়েস"
                                >
                                  <Receipt className="w-4 h-4" />
                                </button>
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

      <Modal isOpen={showInvoiceEditModal} onClose={() => { setShowInvoiceEditModal(false); setEditInvoiceApt(null); }} title="ইনভয়েস" size="md">
        {editInvoiceApt && (
          <div className="space-y-5">
            <div className="p-4 bg-sky-50 rounded-xl border border-sky-200">
              <p className="text-sm text-slate-500 mb-1">ডাক্তার</p>
              <p className="font-semibold">{editInvoiceApt.doctors?.name || editInvoiceApt.doctorName || ''}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 mb-2 block">রোগীর ধরন / ফি</label>
              <div className="grid grid-cols-3 gap-2">
                {FEE_TYPES.map((ft) => (
                  <button key={ft.value} type="button" onClick={() => { setEditFeeType(ft.value); if (editAdvance > getFeeAmount(ft.value)) setEditAdvance(getFeeAmount(ft.value)); }}
                    className={`py-3 px-2 rounded-lg border-2 text-center transition-all text-sm ${editFeeType === ft.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="font-semibold">{ft.label}</div>
                    <div className="text-xs mt-0.5 opacity-75">৳{ft.amount}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">মোট ফি</label>
                <div className="text-lg font-bold text-slate-900">৳{getFeeAmount(editFeeType)}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">অগ্রিম টাকা (Advance)</label>
                <input
                  type="number"
                  min={0}
                  max={getFeeAmount(editFeeType)}
                  value={editAdvance || ''}
                  placeholder="০"
                  onChange={(e) => {
                    const val = Math.min(Math.max(parseInt(e.target.value) || 0, 0), getFeeAmount(editFeeType));
                    setEditAdvance(val);
                  }}
                  className="input w-full text-center font-semibold"
                />
              </div>
              <div className="col-span-2 flex justify-between text-sm pt-1 border-t border-slate-200">
                <span className="text-slate-500">বাকি (Due):</span>
                <span className="font-bold text-primary-600">৳{getFeeAmount(editFeeType) - editAdvance}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={() => handleSaveInvoice(true)} className="flex-1 !bg-emerald-500 hover:!bg-emerald-600" disabled={savingInvoice}>
                <Receipt className="w-4 h-4 mr-2" /> {savingInvoice ? 'সেভ হচ্ছে...' : 'সেভ এন্ড প্রিন্ট'}
              </Button>
              <Button onClick={() => handleSaveInvoice(false)} className="flex-1" variant="secondary" disabled={savingInvoice}>
                {savingInvoice ? 'সেভ হচ্ছে...' : 'সেভ'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* WALK-IN MODAL */}
      <Modal
        isOpen={showWalkinModal}
        onClose={() => setShowWalkinModal(false)}
        title="নতুন অ্যাপয়েন্টমেন্ট"
      >
        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-600 mb-2 block">রোগীর নাম *</label>
            <input
              type="text"
              value={walkinPatient.name}
              onChange={(e) => setWalkinPatient({ ...walkinPatient, name: e.target.value })}
              className="input w-full"
              placeholder="রোগীর নাম লিখুন"
            />
          </div>

<div className="grid grid-cols-1 gap-3">
             <div>
               <label className="text-sm font-medium text-slate-600 mb-2 block">ফোন নম্বর</label>
               <input
                 type="tel"
                 value={walkinPatient.phone}
                 onChange={(e) => setWalkinPatient({ ...walkinPatient, phone: e.target.value })}
                 className="input w-full"
                 placeholder="01XXXXXXXXX"
               />
             </div>
           </div>
           
           <div className="grid grid-cols-2 gap-3">
               <div>
                 <label className="text-sm font-medium text-slate-600 mb-2 block">বয়স *</label>
                 <input
                   type="number"
                   value={walkinPatient.age || ''}
                   onChange={(e) => setWalkinPatient({ ...walkinPatient, age: parseInt(e.target.value) || 0 })}
                   className="input w-full"
                   placeholder="বয়স"
                 />
               </div>
               <div>
                 <label className="text-sm font-medium text-slate-600 mb-2 block">লিঙ্গ *</label>
                 <select
                   value={walkinPatient.sex}
                   onChange={(e) => setWalkinPatient({ ...walkinPatient, sex: e.target.value as 'male' | 'female' | 'other' })}
                   className="input w-full"
                 >
                   <option value="">লিঙ্গ নির্বাচন করুন</option>
                   <option value="male">পুরুষ</option>
                   <option value="female">মহিলা</option>
                   <option value="other">অন্যান্য</option>
                 </select>
               </div>
             </div>

          <div>
            <label className="text-sm font-medium text-slate-600 mb-2 block">ডাক্তার নির্বাচন *</label>
            <select
              value={walkinPatient.doctor_id}
              onChange={(e) => setWalkinPatient({ ...walkinPatient, doctor_id: e.target.value })}
              className="input w-full"
            >
              <option value="">ডাক্তার নির্বাচন করুন</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} - {d.specialization || 'General'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 mb-2 block">ধরন</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setWalkinPatient({ ...walkinPatient, type: 'in-person' })}
                className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${walkinPatient.type === 'in-person'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-slate-200 hover:border-slate-300'
                  }`}
              >
                সরাসরি
              </button>
              <button
                type="button"
                onClick={() => setWalkinPatient({ ...walkinPatient, type: 'teleconsult' })}
                className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${walkinPatient.type === 'teleconsult'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-slate-200 hover:border-slate-300'
                  }`}
              >
                ভিডিও কল
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 mb-2 block">রোগীর ধরন / ফি</label>
            <div className="grid grid-cols-3 gap-2">
              {FEE_TYPES.map((ft) => (
                <button
                  key={ft.value}
                  type="button"
                  onClick={() => setWalkinPatient({ ...walkinPatient, fee_type: ft.value })}
                  className={`py-3 px-2 rounded-lg border-2 text-center transition-all text-sm ${
                    walkinPatient.fee_type === ft.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold">{ft.label}</div>
                  <div className="text-xs mt-0.5 opacity-75">৳{ft.amount}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">মোট ফি</label>
              <div className="text-lg font-bold text-slate-900">৳{getFeeAmount(walkinPatient.fee_type)}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">অগ্রিম টাকা (Advance)</label>
              <input
                type="number"
                min={0}
                max={getFeeAmount(walkinPatient.fee_type)}
                value={walkinPatient.advance || ''}
                placeholder="০"
                onChange={(e) => {
                  const val = Math.min(Math.max(parseInt(e.target.value) || 0, 0), getFeeAmount(walkinPatient.fee_type));
                  setWalkinPatient({ ...walkinPatient, advance: val });
                }}
                className="input w-full text-center font-semibold"
              />
            </div>
            <div className="col-span-2 flex justify-between text-sm pt-1 border-t border-slate-200">
              <span className="text-slate-500">বাকি (Due):</span>
              <span className="font-bold text-primary-600">৳{getFeeAmount(walkinPatient.fee_type) - walkinPatient.advance}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-600 mb-2 block">তারিখ</label>
              <input
                type="date"
                value={walkinPatient.date}
                onChange={(e) => setWalkinPatient({ ...walkinPatient, date: e.target.value, time: '' })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 mb-2 block">সময় *</label>
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setSpecialTimePower(!specialTimePower)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${specialTimePower
                      ? 'bg-amber-100 text-amber-700 border border-amber-300'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                >
                  <Zap className="w-4 h-4" />
                  বিশেষ ক্ষমতা ~ সময়
                </button>
              </div>
              {specialTimePower && (
                <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg mb-2">
                  বর্তমান সময় ব্যবহার করা হবে
                </div>
              )}
              {availableSlots.length > 0 ? (
                <select
                  value={walkinPatient.time}
                  onChange={(e) => setWalkinPatient({ ...walkinPatient, time: e.target.value })}
                  className="input w-full"
                  disabled={specialTimePower}
                >
                  <option value="">সময় নির্বাচন করুন</option>
                  {availableSlots.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              ) : (
                <div className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
                  এই তারিখে ডাক্তারের কোনো শিফট নেই
                </div>
              )}
            </div>
          </div>


          <Button
            onClick={handleAddWalkin}
            className="w-full"
            disabled={creatingWalkin}
          >
            {creatingWalkin ? 'যোগ হচ্ছে...' : 'অ্যাপয়েন্টমেন্ট যোগ করুন'}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={showQRModal} onClose={() => setShowQRModal(false)} title="অ্যাপয়েন্টমেন্ট স্লিপ" size="md">
        {qrAppointment && (
          <div className="space-y-4">
            <AppointmentSlip
              patientId={qrAppointment.patient_id}
              patientSerial={qrAppointment.serial_number}
              appointmentDate={qrAppointment.date}
              patientName={qrAppointment.patients?.name || ''}
              patientGender={qrAppointment.patients?.sex || ''}
              patientAge={qrAppointment.patients?.age ?? ''}
              patientPhone={qrAppointment.patients?.phone || ''}
              patientBcode={qrAppointment.patients?.bcode || ''}
              doctorName={qrAppointment.doctors?.name || ''}
              doctorDegree={qrAppointment.doctors?.degree || ''}
              doctorDesignation={qrAppointment.doctors?.designation || ''}
              doctorSpecialty={qrAppointment.doctors?.specialty || ''}
            />
            <Button onClick={() => handlePrintSlip(qrAppointment)} className="w-full">প্রিন্ট করুন</Button>
          </div>
        )}
      </Modal>



      {/* HISTORY MODAL */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => { setShowHistoryModal(false); setHistoryStep(-1); }}
        title="রোগী ইতিহাস"
        size="xl"
      >
        <div className="space-y-6">
          <p className="font-semibold text-lg">{historyPatient?.patient_name} এর জন্য ইতিহাস ফর্ম</p>
          {historyLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
                <span className="text-sm text-slate-400">লোড হচ্ছে...</span>
              </div>
            </div>
          ) : historyQuestions.length === 0 ? (
            <p className="text-slate-500">কোনো প্রশ্ন পাওয়া যায়নি</p>
          ) : (
              (() => {
                const grouped = historyQuestions.reduce((acc: Record<string, any[]>, q: any) => {
                  const disease = q.disease_name || 'সাধারণ';
                  if (!acc[disease]) acc[disease] = [];
                  acc[disease].push(q);
                  return acc;
                }, {});
                const diseaseNames = Object.keys(grouped);

                // --- DISEASE SELECTION SCREEN ---
                if (historyStep === -1) {
                  const calcBmi = (w: string, h: string) => { const wt = parseFloat(w); const ht = parseFloat(h); return (wt > 0 && ht > 0) ? (wt / ((ht / 100) * (ht / 100))).toFixed(1) : ''; };
                  return (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-3">
                        {diseaseNames.map((name, idx) => (
                          <button
                            key={name}
                            onClick={() => setHistoryStep(idx)}
                            className="p-5 rounded-xl border-2 border-slate-200 hover:border-primary-400 hover:bg-primary-50 transition-all text-left"
                          >
                            <h4 className="font-bold text-primary-700 text-lg">{name}</h4>
                            <p className="text-xs text-slate-500 mt-1">{grouped[name].length} টি প্রশ্ন</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }

                // --- QUESTIONS SCREEN ---
                const currentDisease = diseaseNames[historyStep];
                const currentQuestions = grouped[currentDisease];

                return (
                  <>
                    {/* Disease header */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-primary-700">{currentDisease}</h3>
                    </div>

                    {/* Questions */}
                    <div className="space-y-4">
                      {currentQuestions.map((q: any, qIdx: number) => {
                        const imgKey = `${q.id}_img`;
                        const vidKey = `${q.id}_vid`;
                        const audKey = `${q.id}_aud`;
                        const getFilesArr = (val: string | undefined): string[] => {
                          if (!val) return [];
                          try { const p = JSON.parse(val); return Array.isArray(p) ? p : [val]; }
                          catch { return [val]; }
                        };
                        const uploadBtn = (label: string, key: string, accept: string, icon: any) => {
                          const files = getFilesArr(historyAnswers[key]);
                          return (
                            <div className="space-y-1">
                              {files.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {files.map((file, idx) => (
                                    <div key={idx} className="relative inline-block group">
                                      {accept.startsWith('image') && <img src={file} alt="" className="max-h-28 rounded-lg object-cover" />}
                                      {accept.startsWith('video') && <video src={file} controls className="max-h-28 rounded-lg" />}
                                      {accept.startsWith('audio') && <audio src={file} controls className="h-10" />}
                                      <button type="button" onClick={() => {
                                        const updated = files.filter((_, i) => i !== idx);
                                        setHistoryAnswers((p: any) => {
                                          const a = {...p};
                                          if (updated.length > 0) a[key] = JSON.stringify(updated);
                                          else delete a[key];
                                          return a;
                                        });
                                      }} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">X</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = accept;
                                  const MAX_FILE_SIZE = 50 * 1024 * 1024;
                                  input.onchange = async (e: any) => {
                                    const file = e.target?.files?.[0];
                                    if (!file) return;
                                    if (file.size > MAX_FILE_SIZE) {
                                      toast.error('ফাইলের সাইজ ৫০MB এর বেশি হতে পারবে না');
                                      return;
                                    }
                                    const expectedType = accept.split('/')[0];
                                    if (!file.type.startsWith(expectedType + '/')) {
                                      const typeLabels: Record<string, string> = { image: 'ছবি', video: 'ভিডিও', audio: 'অডিও' };
                                      toast.error(`অনুগ্রহ করে একটি বৈধ ${typeLabels[expectedType] || expectedType} ফাইল নির্বাচন করুন`);
                                      return;
                                    }
                                    const loadingToastId = toast.loading('আপলোড হচ্ছে...');
                                    try {
                                      const url = await uploadToCloudinary(file);
                                      setHistoryAnswers((p: any) => {
                                        const prev = p[key];
                                        let arr: string[] = [];
                                        if (prev) {
                                          try { const parsed = JSON.parse(prev); arr = Array.isArray(parsed) ? parsed : [prev]; }
                                          catch { arr = [prev]; }
                                        }
                                        return {...p, [key]: JSON.stringify([...arr, url])};
                                      });
                                      toast.dismiss(loadingToastId);
                                      toast.success('আপলোড সফল');
                                    } catch (err: any) {
                                      toast.dismiss(loadingToastId);
                                      toast.error(err?.message?.includes('Cloudinary') ? err.message : 'আপলোড ব্যর্থ হয়েছে');
                                    }
                                  };
                                  input.click();
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-xs font-medium"
                              >
                                {icon}
                                {label}
                              </button>
                            </div>
                          );
                        };
                        return (
                          <div key={q.id} className="bg-slate-50 rounded-xl p-4 space-y-3">
                            <div className="flex items-start gap-3">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                                {qIdx + 1}
                              </span>
                              <div className="flex-1 space-y-3">
                                <label className="text-sm font-semibold text-slate-700">{q.question}</label>
                                {q.type === 'multiple_choice' ? (
                                  <div className="space-y-2">
                                    {(q.options || []).map((opt: string, oIdx: number) => (
                                      <label key={oIdx} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-primary-300 cursor-pointer transition-all has-[:checked]:bg-primary-50 has-[:checked]:border-primary-400">
                                        <input
                                          type="radio"
                                          name={q.id}
                                          value={opt}
                                          checked={historyAnswers[q.id] === opt}
                                          onChange={(e) => setHistoryAnswers({ ...historyAnswers, [q.id]: e.target.value })}
                                          className="w-4 h-4 text-primary-600 accent-primary-600"
                                        />
                                        <span className="text-sm text-slate-700">{opt}</span>
                                      </label>
                                    ))}
                                  </div>
                                ) : q.type === 'checkboxes' ? (
                                  <div className="space-y-2">
                                    {(q.options || []).map((opt: string, oIdx: number) => {
                                      const checked = (historyAnswers[q.id] || '').split(',').includes(opt);
                                      return (
                                        <label key={oIdx} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-primary-300 cursor-pointer transition-all has-[:checked]:bg-primary-50 has-[:checked]:border-primary-400">
                                          <input
                                            type="checkbox"
                                            value={opt}
                                            checked={checked}
                                            onChange={(e) => {
                                              const current = (historyAnswers[q.id] || '').split(',').filter(Boolean);
                                              const updated = e.target.checked
                                                ? [...current, opt]
                                                : current.filter((v: string) => v !== opt);
                                              setHistoryAnswers({ ...historyAnswers, [q.id]: updated.join(',') });
                                            }}
                                            className="w-4 h-4 text-primary-600 rounded accent-primary-600"
                                          />
                                          <span className="text-sm text-slate-700">{opt}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                ) : q.type === 'scale' ? (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-1 w-full">
                                      {(q.options || []).map((val: string, oIdx: number) => {
                                        const count = (q.options || []).length;
                                        const size = count > 7 ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
                                        return (
                                          <button
                                            key={oIdx}
                                            type="button"
                                            onClick={() => setHistoryAnswers({ ...historyAnswers, [q.id]: val })}
                                            className={`${size} rounded-full font-medium transition-all flex-shrink-0 ${
                                              historyAnswers[q.id] === val
                                                ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30 scale-110'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                          >
                                            {val}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {q.options && q.options.length >= 2 && (
                                      <div className="flex justify-between text-xs text-slate-400 px-1">
                                        <span>{q.options[0]} - {q.options[q.options.length - 1]}</span>
                                      </div>
                                    )}
                                  </div>
                                ) : q.type === 'date' ? (
                                  <input
                                    type="date"
                                    value={historyAnswers[q.id] || ''}
                                    onChange={(e) => setHistoryAnswers({ ...historyAnswers, [q.id]: e.target.value })}
                                    className="input w-full"
                                  />
                                ) : q.type === 'time' ? (
                                  <input
                                    type="time"
                                    value={historyAnswers[q.id] || ''}
                                    onChange={(e) => setHistoryAnswers({ ...historyAnswers, [q.id]: e.target.value })}
                                    className="input w-full"
                                  />
                                ) : q.type === 'dropdown' ? (
                                  <select
                                    value={historyAnswers[q.id] || ''}
                                    onChange={(e) => setHistoryAnswers({ ...historyAnswers, [q.id]: e.target.value })}
                                    className="input w-full"
                                  >
                                    <option value="">নির্বাচন করুন</option>
                                    {(q.options || []).map((opt: string, oIdx: number) => (
                                      <option key={oIdx} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                ) : q.type === 'file_upload' ? (
                                  <div className="space-y-2">
                                    {q.acceptTypes && q.acceptTypes.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 items-center">
                                        <span className="text-[11px] text-slate-400 font-medium">গ্রহণযোগ্য:</span>
                                        {q.acceptTypes.includes('image') && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-600 border border-blue-200">ছবি</span>}
                                        {q.acceptTypes.includes('video') && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-600 border border-purple-200">ভিডিও</span>}
                                        {q.acceptTypes.includes('audio') && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">অডিও</span>}
                                      </div>
                                    )}
                                    <div className="flex flex-wrap gap-2">
                                      {(!q.acceptTypes || q.acceptTypes.length === 0 || q.acceptTypes.includes('image')) && uploadBtn('ছবি', imgKey, 'image/*', <Upload className="w-3.5 h-3.5" />)}
                                      {(!q.acceptTypes || q.acceptTypes.length === 0 || q.acceptTypes.includes('video')) && uploadBtn('ভিডিও', vidKey, 'video/*', <Video className="w-3.5 h-3.5" />)}
                                      {(!q.acceptTypes || q.acceptTypes.length === 0 || q.acceptTypes.includes('audio')) && uploadBtn('অডিও', audKey, 'audio/*', <Upload className="w-3.5 h-3.5" />)}
                                    </div>
                                  </div>
                                ) : q.type === 'paragraph' ? (
                                  <textarea
                                    value={historyAnswers[q.id] || ''}
                                    onChange={(e) => setHistoryAnswers({ ...historyAnswers, [q.id]: e.target.value })}
                                    className="input w-full min-h-[70px] resize-y"
                                    placeholder="লিখুন..."
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    value={historyAnswers[q.id] || ''}
                                    onChange={(e) => setHistoryAnswers({ ...historyAnswers, [q.id]: e.target.value })}
                                    className="input w-full"
                                    placeholder="লিখুন..."
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                      <Button variant="secondary" onClick={() => setHistoryStep(-1)}>
                        রোগ নির্বাচন
                      </Button>
                      <Button onClick={submitHistoryAnswers}>
                        সংরক্ষণ করুন
                      </Button>
                    </div>
                  </>
                );
              })()
          )}
        </div>
      </Modal>

      <VitalsModal
        isOpen={showVitalsModal}
        onClose={() => { setShowVitalsModal(false); setVitalsAppointment(null); }}
        onSave={handleSaveVitals}
        initialVitals={vitalsAppointment ? (vitalsData[vitalsAppointment.id] || vitalsAppointment.vitals) : undefined}
        patientName={vitalsAppointment?.patients?.name}
      />
    </DashboardLayout>
  );
}