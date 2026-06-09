'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Search, Filter, Check, X, Calendar, Clock, Video, MoreVertical, ChevronLeft, ChevronRight, ChevronDown, CheckCircle, Plus, Zap, FileText, Upload } from 'lucide-react';
import { supabase, supabase1, generateSerialNumber } from '@/lib/supabase';
import { setCache, getCache } from '@/lib/cache';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { QRCode } from '@/components/ui/QRCode';
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
    weight: 0 as number,
    doctor_id: '',
    type: 'in-person' as 'in-person' | 'teleconsult',
    date: getLocalDateString(),
    time: '',
    reason: '',
    compliant: '',
  });
  const [creatingWalkin, setCreatingWalkin] = useState(false);
  const [specialTimePower, setSpecialTimePower] = useState(false);
  const [customTime, setCustomTime] = useState('');
  const [schedules, setSchedules] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrAppointment, setQRAppointment] = useState<any>(null);
  const [showPrescribeConfirm, setShowPrescribeConfirm] = useState(false);
  const [prescribePatient, setPrescribePatient] = useState<any>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyPatient, setHistoryPatient] = useState<any>(null);
  const [historyQuestions, setHistoryQuestions] = useState<any[]>([]);
  const [historyAnswers, setHistoryAnswers] = useState<{[key: string]: string}>({});
  const [historyStep, setHistoryStep] = useState(0);

  useEffect(() => {
    loadData();

    if (localStorage.getItem('openAppointmentModal') === 'true') {
      localStorage.removeItem('openAppointmentModal');
      setTimeout(() => setShowWalkinModal(true), 500);
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
      .select('*, doctors(name, specialization), patients(name, phone)')
      .order('date', { ascending: false })
      .limit(100);

    if (aptError) {
      console.error('Error fetching appointments:', aptError);
      toast.error('অ্যাপয়েন্টমেন্ট লোড করতে সমস্যা হয়েছে');
    }

    if (apts) {
      const mapped = apts.map((apt: any) => {
        const schedule = apt.schedules?.[0];
        return {
          ...apt,
          doctorName: apt.doctors?.name || '-',
          specialization: apt.doctors?.specialization || '-',
          patientName: apt.patients?.name || '-',
          start_time: schedule?.start_time || null,
          end_time: schedule?.end_time || null,
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
        const aStatus = a.displayStatus;
        const bStatus = b.displayStatus;
        return (statusOrder[aStatus] || 99) - (statusOrder[bStatus] || 99);
      });

      setAppointments(sorted);
      setCache('admin_appointments', sorted);
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
  };

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
        apt.type === 'teleconsult' ? 'teleconsult' : 'appointment'
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
              apt.time || '',
              apt.serial_number || ''
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
       // First, create a minimal patient record to satisfy the foreign key constraint
       const { data: newPatient, error: patientError } = await supabase
         .from('patients')
         .insert({
           name: walkinPatient.name,
           phone: walkinPatient.phone || '',
           email: `walkin_${Date.now()}@clinicconnect.local`,
           password: 'walkin_temp',
           age: walkinPatient.age,
           sex: walkinPatient.sex || 'male',
           weight: walkinPatient.weight,
            compliant: walkinPatient.compliant || 'false',
         })
         .select('id')
         .single();

      if (patientError || !newPatient) {
        console.error('Patient Insert Error:', patientError);
        toast.error(`রোগী তৈরি করতে ব্যর্থ: ${patientError?.message || 'Unknown error'}`);
        setCreatingWalkin(false);
        return;
      }

      const getCurrentTime = () => {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    };
    
    const appointmentTime = specialTimePower
      ? getCurrentTime()
      : (walkinPatient.time ? walkinPatient.time.split(' - ')[0] : '09:00');

      const type = walkinPatient.type === 'teleconsult' ? 'teleconsult' : 'appointment';
      console.log('Creating appointment with:', { doctorId: walkinPatient.doctor_id, date: walkinPatient.date, type });

      const serialNumber = await generateSerialNumber(walkinPatient.doctor_id, walkinPatient.date, type);
      console.log('Generated serial:', serialNumber);

      const { error: aptError } = await supabase
        .from('appointments')
        .insert({
          patient_id: newPatient.id,
          doctor_id: walkinPatient.doctor_id,
          date: walkinPatient.date,
          time: appointmentTime,
          status: 'confirmed',
          type: walkinPatient.type,
          reason: walkinPatient.reason || 'ওয়াক-ইন',
          serial_number: serialNumber,
        });

      console.log('Appointment insert result:', { error: aptError });

if (aptError) {
       console.error('Appointment Insert Error:', aptError);
       toast.error(`অ্যাপয়েন্টমেন্ট তৈরি করতে ব্যর্থ: ${aptError?.message || 'Unknown error'}`);
       setCreatingWalkin(false);
       return;
     }

     // Show QR code modal after successful creation
     const { data: createdApt } = await supabase
       .from('appointments')
       .select('*, patients(*), doctors(*)')
       .eq('patient_id', newPatient.id)
       .order('created_at', { ascending: false })
       .limit(1)
       .single();

      toast.success('অ্যাপয়েন্টমেন্ট যোগ হয়েছে');
      setQRAppointment(createdApt);
      setShowQRModal(true);

      try {
        const walkinPhone = walkinPatient.phone;
        if (walkinPhone) {
          const walkinDoctor = doctors.find(d => d.id === walkinPatient.doctor_id);
          const smsText = buildConfirmationSMS(
            walkinDoctor?.name || '',
            walkinPatient.date,
            appointmentTime,
            serialNumber || ''
          );
          await sendSMS(walkinPhone, smsText);
        }
      } catch (e) {
        console.error('Walkin SMS error:', e);
      }
     setShowWalkinModal(false);
      setWalkinPatient({ name: '', phone: '', age: 0, sex: 'male', weight: 0, doctor_id: '', type: 'in-person', date: getLocalDateString(), time: '', reason: '', compliant: '' });
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
    setPrescribePatient({
      patient_id: apt.patient_id,
    });
    setShowPrescribeConfirm(true);
  };

  const handleHistory = async (apt: any) => {
    try {
      console.log('Fetching history_templates from supabase1...');
      const { data: templates, error: templatesError } = await supabase1
        .from('history_templates')
        .select('*');
      
      if (templatesError) {
        console.error('Error fetching history_templates:', templatesError);
      }
      console.log('Templates received:', templates);
      
      const typeMap: Record<string, string> = {
        'text': 'text', 'Short Text': 'text',
        'paragraph': 'paragraph', 'Paragraph': 'paragraph',
        'multiple_choice': 'multiple_choice', 'Multiple Choice': 'multiple_choice',
        'checkboxes': 'checkboxes', 'Checkboxes': 'checkboxes',
        'dropdown': 'dropdown', 'Dropdown': 'dropdown',
        'file_upload': 'file_upload', 'Media Upload': 'file_upload',
        'date': 'date', 'Date': 'date',
        'time': 'time', 'Time': 'time',
        'scale': 'scale', 'Linear Scale': 'scale',
      };

      const flatQuestions = (templates || []).flatMap((row: any) =>
        (row.questions || []).map((q: any, idx: number) => {
          if (typeof q === 'string') {
            return { id: `${row.id}_${idx}`, disease_name: row.disease_name, question: q, type: 'paragraph', options: [], required: false };
          }
          const rawType = q.type || 'paragraph';
          return {
            id: q.id || `${row.id}_${idx}`,
            disease_name: row.disease_name,
            question: q.text || q.question || '',
            type: typeMap[rawType] || 'text',
            options: q.options || [],
            required: q.required || false,
          };
        })
      );
      
      const { data: existingHistory } = await supabase
        .from('patient_history')
        .select('*')
        .eq('patient_id', apt.patient_id);
      
      const existingAnswers: {[key: string]: string} = {};
      if (existingHistory) {
        existingHistory.forEach((h: any) => {
          existingAnswers[h.question_id] = h.answer;
        });
      }
      
      const fallbackTemplates = [
        { id: 'demo-1', disease_name: 'ডায়াবেটিস', question: 'আপনার বর্তমান সুগার লেভেল কত?' },
        { id: 'demo-2', disease_name: 'ডায়াবেটিস', question: 'কখন শেষবার চেক করেছিলেন?' },
        { id: 'demo-3', disease_name: 'উচ্চ রক্তচাপ', question: 'আপনার বর্তমান প্রেসার কত?' },
        { id: 'demo-4', disease_name: 'উচ্চ রক্তচাপ', question: 'ওষুধ নিয়মিত খান?' },
        { id: 'demo-5', disease_name: 'হৃদরোগ', question: 'বুকে ব্যথা অনুভব করছেন?' },
        { id: 'demo-6', disease_name: 'হৃদরোগ', question: 'শ্বাস নিতে কষ্ট হচ্ছে?' },
      ];
      setHistoryQuestions(flatQuestions.length > 0 ? flatQuestions : fallbackTemplates);
      setHistoryStep(-1);
    } catch (err) {
      console.error('handleHistory crashed:', err);
      setHistoryQuestions([
        { id: 'demo-1', disease_name: 'ডায়াবেটিস', question: 'আপনার বর্তমান সুগার লেভেল কত?' },
        { id: 'demo-2', disease_name: 'ডায়াবেটিস', question: 'কখন শেষবার চেক করেছিলেন?' },
        { id: 'demo-3', disease_name: 'উচ্চ রক্তচাপ', question: 'আপনার বর্তমান প্রেসার কত?' },
        { id: 'demo-4', disease_name: 'উচ্চ রক্তচাপ', question: 'ওষুধ নিয়মিত খান?' },
        { id: 'demo-5', disease_name: 'হৃদরোগ', question: 'বুকে ব্যথা অনুভব করছেন?' },
        { id: 'demo-6', disease_name: 'হৃদরোগ', question: 'শ্বাস নিতে কষ্ট হচ্ছে?' },
      ]);
      setHistoryStep(-1);
    }
    setHistoryPatient({
      patient_id: apt.patient_id,
      patient_name: apt.patientName,
      appointment_id: apt.id,
    });
    setHistoryAnswers({});
    setShowHistoryModal(true);
  };

  const submitHistoryAnswers = async () => {
    if (!historyPatient) return;

    await supabase
      .from('patient_history')
      .delete()
      .eq('patient_id', historyPatient.patient_id);

    const answersToInsert = Object.entries(historyAnswers).map(([question_id, answer]) => {
      const q = historyQuestions.find((hq: any) => hq.id === question_id);
      return {
        patient_id: historyPatient.patient_id,
        question_id,
        disease_name: q?.disease_name || '',
        question: q?.question || '',
        answer,
      };
    });

    if (answersToInsert.length === 0) {
      toast.success('ইতিহাস সংরক্ষিত হয়েছে');
      setShowHistoryModal(false);
      return;
    }

    const { error } = await supabase
      .from('patient_history')
      .insert(answersToInsert);

    if (!error) {
      toast.success('ইতিহাস সংরক্ষিত হয়েছে');
      setShowHistoryModal(false);
    } else {
      toast.error('ইতিহাস সংরক্ষণে সমস্যা হয়েছে');
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
          <Button onClick={() => setShowWalkinModal(true)}>
            <Plus className="w-5 h-5" /> নতুন অ্যাপয়েন্টমেন্ট
          </Button>
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
                    <td colSpan={9} className="px-4 py-12 text-center">
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
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDate(apt.date)}</span>
                        </div>
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
                                 onClick={() => handleHistory(apt)}
                                 className="p-2 text-purple-500 hover:bg-purple-50 rounded-lg transition-colors"
                                 title="ইতিহাস"
                               >
                                 <FileText className="w-4 h-4" />
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
                                 onClick={() => handleHistory(apt)}
                                 className="p-2 text-purple-500 hover:bg-purple-50 rounded-lg transition-colors"
                                 title="ইতিহাস"
                               >
                                 <FileText className="w-4 h-4" />
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
           
           <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-600 mb-2 block">বয়স *</label>
                <input
                  type="number"
                  value={walkinPatient.age}
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
              <div>
                <label className="text-sm font-medium text-slate-600 mb-2 block">ওজন (kg)</label>
                <input
                  type="number"
                  value={walkinPatient.weight}
                  onChange={(e) => setWalkinPatient({ ...walkinPatient, weight: parseFloat(e.target.value) || 0 })}
                  className="input w-full"
                  placeholder="ওজন"
                />
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


          <div>
            <label className="text-sm font-medium text-slate-600 mb-2 block">রোগীর সমস্যা লিখুন</label>
            <textarea
              value={walkinPatient.reason}
              onChange={(e) => setWalkinPatient({ ...walkinPatient, reason: e.target.value })}
              className="input w-full h-24 resize-none"
              placeholder="রোগীর সমস্যা লিখুন"
            />
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

      {/* QR CODE MODAL */}
      <Modal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        title="অ্যাপয়েন্টমেন্ট QR কোড"
        size="sm"
      >
        {qrAppointment && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center" id="qr-code-print-area">
              <QRCode value={`${window.location.origin}/dashboard/patient/appointments?id=${qrAppointment.id}`} size={200} />
            </div>
            <div className="space-y-2">
              <p className="font-semibold">{qrAppointment.patients?.name}</p>
              <p className="text-sm text-slate-500">{formatDate(qrAppointment.date)} - {qrAppointment.time?.substring(0, 5)}</p>
            </div>
              <Button
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      const qrSvg = document.querySelector('#qr-code-print-area svg');
                      const svgHtml = qrSvg ? qrSvg.outerHTML : '';
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>অ্যাপয়েন্টমেন্ট QR কোড</title>
                          </head>
                          <body style="text-align:center;padding:20px;font-family:sans-serif;">
                            <h2>ক্লিনিক কানেক্ট - অ্যাপয়েন্টমেন্ট</h2>
                            <p>রোগী: ${qrAppointment.patients?.name}</p>
                            <p>তারিখ: ${formatDate(qrAppointment.date)}</p>
                            <p>সময়: ${qrAppointment.time?.substring(0, 5)}</p>
                            ${svgHtml}
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                      printWindow.focus();
                      printWindow.print();
                    }
                  }}
                  className="w-full"
                >
                  প্রিন্ট করুন
                </Button>
          </div>
        )}
      </Modal>

      {/* PRESCRIBE CONFIRM MODAL */}
      <Modal
        isOpen={showPrescribeConfirm}
        onClose={() => setShowPrescribeConfirm(false)}
        title="প্রেসক্রিব নিশ্চিতকরণ"
        size="sm"
      >
        <div className="space-y-4">
          <p>আপনি কি রোগী <strong>{prescribePatient?.patient_name}</strong> এর জন্য প্রেসক্রিব পেজে যেতে চান?</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowPrescribeConfirm(false)} className="flex-1">
              বাতিল
            </Button>
            <Button
              onClick={() => {
                window.open(`https://carescriptrx.vercel.app/dashboard/doctor/prescribe?patient_id=${prescribePatient?.patient_id}`, '_blank');
                setShowPrescribeConfirm(false);
              }}
              className="flex-1"
            >
              যেতে চান
            </Button>
          </div>
        </div>
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
          {historyQuestions.length === 0 ? (
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
                  return (
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
                        const uploadBtn = (label: string, key: string, accept: string, icon: any) => (
                          <div className="space-y-1">
                            {historyAnswers[key] ? (
                              <div className="relative inline-block">
                                {accept.startsWith('image') && <img src={historyAnswers[key]} alt="" className="max-h-28 rounded-lg object-cover" />}
                                {accept.startsWith('video') && <video src={historyAnswers[key]} controls className="max-h-28 rounded-lg" />}
                                {accept.startsWith('audio') && <audio src={historyAnswers[key]} controls className="h-10" />}
                                <button type="button" onClick={() => { const a={...historyAnswers}; delete a[key]; setHistoryAnswers(a); }} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">X</button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = accept;
                                  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
                                  input.onchange = (e: any) => {
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
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                      setHistoryAnswers((p: any) => ({...p, [key]: ev.target?.result as string}));
                                      toast.success('আপলোড সফল');
                                    };
                                    reader.readAsDataURL(file);
                                  };
                                  input.click();
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-xs font-medium"
                              >
                                {icon}
                                {label}
                              </button>
                            )}
                          </div>
                        );
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
                                    <div className="flex items-center justify-between gap-1">
                                      {(q.options || []).map((val: string, oIdx: number) => (
                                        <button
                                          key={oIdx}
                                          type="button"
                                          onClick={() => setHistoryAnswers({ ...historyAnswers, [q.id]: val })}
                                          className={`w-10 h-10 rounded-full text-sm font-medium transition-all ${
                                            historyAnswers[q.id] === val
                                              ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30 scale-110'
                                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                          }`}
                                        >
                                          {val}
                                        </button>
                                      ))}
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
                                  <div className="flex flex-wrap gap-2">
                                    {uploadBtn('ছবি', imgKey, 'image/*', <Upload className="w-3.5 h-3.5" />)}
                                    {uploadBtn('ভিডিও', vidKey, 'video/*', <Video className="w-3.5 h-3.5" />)}
                                    {uploadBtn('অডিও', audKey, 'audio/*', <Upload className="w-3.5 h-3.5" />)}
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
    </DashboardLayout>
  );
}