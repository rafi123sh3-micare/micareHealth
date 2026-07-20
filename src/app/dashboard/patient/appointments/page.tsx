'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Calendar, Clock, Video, X, ChevronRight, FileText, Search, Printer, Receipt } from 'lucide-react';
import Link from 'next/link';
import { supabase, FEE_TYPES, getFeeAmount, numberToWords } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { AppointmentSlip } from '@/components/appointments/AppointmentSlip';
import { generateCashMemoPrint } from '@/components/appointments/CashMemo';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import DatePicker from '@/components/ui/DatePicker';
import { useSearchParams } from 'next/navigation';
import { calculateExpectedTime } from '@/lib/sms';

export default function PatientAppointments() {
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState('all');
  const [filterDoctor, setFilterDoctor] = useState('');
  const [filterType, setFilterType] = useState('');
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [filterDate, setFilterDate] = useState(todayStr);
  const [selectedApt, setSelectedApt] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientInfo, setPatientInfo] = useState<any>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showInvoiceEditModal, setShowInvoiceEditModal] = useState(false);
  const [editInvoiceApt, setEditInvoiceApt] = useState<any>(null);
  const [editFeeType, setEditFeeType] = useState('new');
  const [editAdvance, setEditAdvance] = useState(0);
  const [savingInvoice, setSavingInvoice] = useState(false);

  const getStatusFromDate = (dateStr: string, currentStatus: string) => {
    if (currentStatus === 'cancelled') return 'cancelled';
    if (currentStatus === 'completed') return 'completed';
    if (currentStatus === 'confirmed') return 'confirmed';
    if (currentStatus === 'pending') return 'pending';

    const appointmentDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (appointmentDate < today) return 'completed';
    return 'pending';
  };

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('patientData') || 'null');
    setPatientInfo(data);
  }, []);

  useEffect(() => {
    async function loadAppointments() {
      if (typeof window === 'undefined') {
        setLoading(false);
        return;
      }
      const patientData = JSON.parse(localStorage.getItem('patientData') || 'null');

      if (!patientData || !patientData.id) {
        setLoading(false);
        return;
      }

      const { data: apts } = await supabase
        .from('appointments')
        .select('*, doctors(name, specialization, degree, specialty, designation)')
        .eq('patient_id', patientData.id)
        .order('date', { ascending: true });

      if (apts && apts.length > 0) {
        const mapped = await Promise.all(apts.map(async (apt: any) => {
          const startTime = apt.time;
          let timeRange = startTime ? startTime.substring(0, 5) : '';
          let scheduleStart: string | null = null;

          try {
            const { data: scheduleData } = await supabase
              .from('schedules')
              .select('start_time, end_time, selected_days, start_date, end_date, date')
              .eq('doctor_id', apt.doctor_id)
              .eq('status', 'active');

            if (scheduleData && scheduleData.length > 0) {
              let match: any = null;

              // Try old schema: direct date match
              const oldMatch = scheduleData.find((s: any) => s.date === apt.date);
              if (oldMatch) {
                match = oldMatch;
              } else {
                // Try new schema: match by day name + date range
                const dayMap: Record<number, string> = { 0:'রবিবার', 1:'সোমবার', 2:'মঙ্গলবার', 3:'বুধবার', 4:'বৃহস্পতিবার', 5:'শুক্রবার', 6:'শনিবার' };
                const aptDate = new Date(apt.date + 'T00:00:00');
                const dayName = dayMap[aptDate.getDay()];
                const dayMatch = scheduleData.find((s: any) => {
                  if (!s.selected_days?.includes(dayName)) return false;
                  const startOk = s.start_date ? new Date(s.start_date + 'T00:00:00') <= aptDate : true;
                  const endOk = s.end_date ? new Date(s.end_date + 'T00:00:00') >= aptDate : true;
                  return startOk && endOk;
                });
                if (dayMatch) match = dayMatch;
              }

              if (match) {
                scheduleStart = match.start_time?.substring(0, 5) || null;
                if (match.end_time) timeRange = `${(match.start_time || startTime).substring(0, 5)} - ${match.end_time.substring(0, 5)}`;
              }
            }
          } catch (e) {
            console.error('Error fetching shift time:', e);
          }

          return {
            ...apt,
            doctor: apt.doctors?.name,
            doctorId: apt.doctor_id,
            specialization: apt.doctors?.specialization,
            doctor_degree: apt.doctors?.degree,
            doctor_designation: apt.doctors?.designation,
            doctor_specialty: apt.doctors?.specialty || apt.doctors?.specialization,
            displayStatus: getStatusFromDate(apt.date, apt.status),
            time_range: timeRange,
            scheduleStart
          };
        }));

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
      }
      setLoading(false);
    }

    async function loadDoctors() {
      const { data } = await supabase.from('doctors').select('id, name').order('name');
      if (data) setDoctors(data);
    }

    loadAppointments();
    loadDoctors();
  }, []);

  useEffect(() => {
    const appointmentId = searchParams.get('id');
    if (appointmentId && appointments.length > 0) {
      const apt = appointments.find(a => a.id === appointmentId);
      if (apt) {
        setSelectedApt(apt);
      }
    }
  }, [searchParams, appointments]);

  const filteredApts = appointments.filter(apt => {
    if (filter !== 'all' && apt.displayStatus !== filter) return false;
    if (filterDoctor && apt.doctorId !== filterDoctor) return false;
    if (filterType && apt.type !== filterType) return false;
    if (filterDate && apt.date !== filterDate) return false;
    return true;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    // Convert 06:00:00 to 06:00
    return timeStr.substring(0, 5);
  };

  const filterOptions = [
    { value: 'all', label: 'সব' },
    { value: 'confirmed', label: 'নিশ্চিত' },
    { value: 'pending', label: 'অপেক্ষায়' },
    { value: 'cancelled', label: 'বাতিল' },
    { value: 'completed', label: 'সম্পন্ন' },
  ];

  const handlePrintSlip = async () => {
    if (!selectedApt) return;

    let bcode = patientInfo?.bcode || '';
    if (!bcode && selectedApt.patient_id) {
      try {
        const r = await fetch(`/api/gen-bcode?patient_id=${selectedApt.patient_id}`);
        const d = await r.json();
        if (d.code) bcode = d.code;
      } catch {}
    }

    const pw = window.open('', '_blank');
    if (!pw) return;

    const pName = (patientInfo?.name || '').replace(/[<>]/g, '');
    const pGender = (patientInfo?.gender || patientInfo?.sex || '').replace(/[<>]/g, '');
    const pAge = patientInfo?.age ?? '';
    const pPhone = (patientInfo?.phone || '-').replace(/[<>]/g, '');
    const dName = (selectedApt.doctor || '').replace(/[<>]/g, '');
    const dDegree = (selectedApt.doctor_degree || '').replace(/[<>]/g, '');
    const dDesignation = (selectedApt.doctor_designation || '').replace(/[<>]/g, '');
    const dSpecialty = (selectedApt.doctor_specialty || '').replace(/[<>]/g, '');
    const dCreds = [dDegree, dDesignation, dSpecialty].filter(Boolean).join(', ');
    const pSerial = selectedApt.serial_number || null;
    const pSerialDisplay = pSerial || '-';
    pw.document.write(`<html><head><title>Appointment Slip</title><script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"><\/script><style>@page{size:4.13in 2.17in;margin:2mm}body{font-family:sans-serif;padding:6px;max-width:100%;margin:0 auto;font-size:8px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px}.details{margin-bottom:4px}.details div{margin-bottom:1px;font-size:8px}.label{font-weight:600;color:#555;display:inline-block;width:65px;font-size:8px}.consultant{border-top:1px solid #e2e8f0;padding-top:3px;font-size:8px}.consultant .info{display:inline-block;vertical-align:top}.consultant .name{font-weight:500}.consultant .degree{font-size:7px;color:#666;word-break:break-word;white-space:pre-line}img.logo{height:22px;width:auto}@media print{body{padding:3px}}</style></head><body><div class="header"><div><svg id="barcode"></svg></div><img src="https://iili.io/Cf3Yo8b.png" class="logo" /></div><div class="details"><div><span class="label">Patient Serial:</span>${pSerialDisplay}</div><div><span class="label">Patient Name:</span>${pName}</div><div><span class="label">Gender:</span>${pGender.charAt(0).toUpperCase() + pGender.slice(1)}<span style="margin-left:50px;font-weight:600;color:#555;">Age:</span> ${pAge}</div><div><span class="label">Phone:</span>${pPhone}</div></div><div class="consultant"><span class="label" style="vertical-align:top;">Consultant:</span><div class="info"><div class="name">${dName}</div>${dCreds ? `<div class="degree">${dCreds}</div>` : ''}</div></div><script>${bcode ? `JsBarcode("#barcode","${bcode}",{format:"CODE128",width:1.5,height:50,displayValue:false,margin:5});` : ''}setTimeout(function(){window.print()},500);<\/script></body></html>`);
  };

  const handlePrintSlipFromTable = async (apt: any) => {
    if (!apt) return;

    let bcode = patientInfo?.bcode || '';
    if (!bcode && apt.patient_id) {
      try {
        const r = await fetch(`/api/gen-bcode?patient_id=${apt.patient_id}`);
        const d = await r.json();
        if (d.code) bcode = d.code;
      } catch {}
    }

    const pw = window.open('', '_blank');
    if (!pw) return;

    const pName = (patientInfo?.name || '').replace(/[<>]/g, '');
    const pGender = (patientInfo?.gender || patientInfo?.sex || '').replace(/[<>]/g, '');
    const pAge = patientInfo?.age ?? '';
    const pPhone = (patientInfo?.phone || '-').replace(/[<>]/g, '');
    const dName = (apt.doctor || '').replace(/[<>]/g, '');
    const dDegree = (apt.doctor_degree || '').replace(/[<>]/g, '');
    const dDesignation = (apt.doctor_designation || '').replace(/[<>]/g, '');
    const dSpecialty = (apt.doctor_specialty || '').replace(/[<>]/g, '');
    const dCreds = [dDegree, dDesignation, dSpecialty].filter(Boolean).join(', ');
    const pSerial = apt.serial_number || null;
    const pSerialDisplay = pSerial || '-';
    pw.document.write(`<html><head><title>Appointment Slip</title><script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"><\/script><style>@page{size:4.13in 2.17in;margin:2mm}body{font-family:sans-serif;padding:6px;max-width:100%;margin:0 auto;font-size:8px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px}.details{margin-bottom:4px}.details div{margin-bottom:1px;font-size:8px}.label{font-weight:600;color:#555;display:inline-block;width:65px;font-size:8px}.consultant{border-top:1px solid #e2e8f0;padding-top:3px;font-size:8px}.consultant .info{display:inline-block;vertical-align:top}.consultant .name{font-weight:500}.consultant .degree{font-size:7px;color:#666;word-break:break-word;white-space:pre-line}img.logo{height:22px;width:auto}@media print{body{padding:3px}}</style></head><body><div class="header"><div><svg id="barcode"></svg></div><img src="https://iili.io/Cf3Yo8b.png" class="logo" /></div><div class="details"><div><span class="label">Patient Serial:</span>${pSerialDisplay}</div><div><span class="label">Patient Name:</span>${pName}</div><div><span class="label">Gender:</span>${pGender.charAt(0).toUpperCase() + pGender.slice(1)}<span style="margin-left:50px;font-weight:600;color:#555;">Age:</span> ${pAge}</div><div><span class="label">Phone:</span>${pPhone}</div></div><div class="consultant"><span class="label" style="vertical-align:top;">Consultant:</span><div class="info"><div class="name">${dName}</div>${dCreds ? `<div class="degree">${dCreds}</div>` : ''}</div></div><script>${bcode ? `JsBarcode("#barcode","${bcode}",{format:"CODE128",width:1.5,height:50,displayValue:false,margin:5});` : ''}setTimeout(function(){window.print()},500);<\/script></body></html>`);
    pw.document.close();
  };

  const handlePrintInvoice = async (apt: any) => {
    let bcode = patientInfo?.bcode || '';
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
      hn: patientInfo?.id?.substring(0, 8) || '-',
      barcode: bcode,
      patientName: patientInfo?.name || '',
      patientAge: patientInfo?.age ?? '',
      patientGender: patientInfo?.gender || patientInfo?.sex || '',
      patientMobile: patientInfo?.phone || '',
      patientAddress: '',
      conType: apt.type === 'teleconsult' ? 'Teleconsultation' : 'In-person Visit',
      department: apt.specialization || 'General',
      consultant: apt.doctor || '',
      services: [
        { name: `${feeLabel} Fee (${apt.doctor || 'Doctor'})`, amount: feeAmt },
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
      setSelectedApt((prev: any) => prev?.id === updatedApt.id ? updatedApt : prev);

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
      <DashboardLayout role="patient">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="patient">
      <div className="space-y-6 page-enter">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">আমার অ্যাপয়েন্টমেন্ট</h1>
          <p className="text-slate-500 mt-1">আপনার সকল অ্যাপয়েন্টমেন্ট</p>
        </div>

        <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-lg shadow-slate-200/20">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="min-w-[140px]">
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

            <div className="min-w-[140px]">
              <label className="text-sm font-medium text-slate-600 mb-2 block">ধরন</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="input"
              >
                <option value="">সব ধরন</option>
                <option value="walkin">সরাসরি ভিজিট</option>
                <option value="teleconsult">ভিডিও কল</option>
              </select>
            </div>

            <div className="min-w-[140px]">
              <label className="text-sm font-medium text-slate-600 mb-2 block">তারিখ</label>
              <DatePicker
                value={filterDate}
                onChange={setFilterDate}
                className="!w-full"
              />
            </div>

            <div className="min-w-[140px]">
              <label className="text-sm font-medium text-slate-600 mb-2 block">স্ট্যাটাস</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="input"
              >
                {filterOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {(filterDoctor || filterType || filterDate || filter !== 'all') && (
              <button
                onClick={() => {
                  setFilterDoctor('');
                  setFilterType('');
                  setFilterDate('');
                  setFilter('all');
                }}
                className="px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                রিসেট
              </button>
            )}
          </div>
        </Card>

        {/* Appointments List */}
        {filteredApts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 mb-4">কোনো অ্যাপয়েন্টমেন্ট নেই</p>
            <Link href="/dashboard/patient/book" className="btn-primary text-sm">
              অ্যাপয়েন্টমেন্ট বুক করুন
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApts.map((apt) => (
              <Card
                key={apt.id}
                className="cursor-pointer group"
                onClick={() => setSelectedApt(apt)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`
                      w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-md
                      ${apt.displayStatus === 'completed' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' :
                        apt.displayStatus === 'cancelled' ? 'bg-gradient-to-br from-slate-400 to-slate-500' :
                        apt.type === 'teleconsult' ? 'bg-gradient-to-br from-purple-400 to-violet-600' :
                        'bg-gradient-to-br from-sky-400 to-blue-600'}
                    `}>
                      {apt.date?.split('-')[2] || '০১'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{apt.doctor || 'ডাক্তার'}</h3>
                      <p className="text-sm text-slate-500">{apt.specialization}</p>
                    </div>
                  </div>
                  <StatusPill status={apt.displayStatus as any} />
                </div>

                <div className="flex items-center gap-4 text-sm text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {formatDate(apt.date)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" />
                    {apt.serial_number ? calculateExpectedTime(apt.scheduleStart, apt.serial_number) : apt.time_range}
                  </span>
                  <span className={`flex items-center gap-1.5 ${apt.type === 'teleconsult' ? 'text-purple-600' : ''}`}>
                    <span className="text-slate-500">ধরন:</span>
                    {apt.type === 'teleconsult' && <Video className="w-4 h-4" />}
                    {apt.type === 'teleconsult' ? 'ভিডিও' : 'সরাসরি'}
                  </span>
                  {(apt.serial_number && (apt.status === 'confirmed' || apt.status === 'completed')) && (
                    <span className="flex items-center gap-1.5">
                      <span className="text-slate-500">সিরিয়াল:</span>
                      <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                        {apt.serial_number}
                      </span>
                    </span>
                  )}
                </div>

                {apt.reason && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-sm text-slate-500 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {apt.reason.length > 50 ? apt.reason.substring(0, 50) + '...' : apt.reason}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePrintSlipFromTable(apt); }}
                      className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-primary-600 transition-colors"
                      title="স্লিপ প্রিন্ট"
                    >
                      <Printer className="w-4 h-4" />
                      <span className="text-xs">প্রিন্ট</span>
                    </button>
                    {(apt.status === 'confirmed' || apt.status === 'completed') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditInvoiceApt(apt); setEditFeeType(apt.fee_type || 'new'); setEditAdvance(apt.advance || 0); setShowInvoiceEditModal(true); }}
                        className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 transition-colors"
                        title="ইনভয়েস"
                      >
                        <Receipt className="w-4 h-4" />
                        <span className="text-xs">ইনভয়েস</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-sm font-medium">বিস্তারিত</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Detail Modal */}
        <Modal
          isOpen={!!selectedApt}
          onClose={() => setSelectedApt(null)}
          title="অ্যাপয়েন্টমেন্ট বিস্তারিত"
          size="md"
        >
          {selectedApt && (
            <div className="space-y-5">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                <div className={`
                  w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold shadow-md
                  ${selectedApt.displayStatus === 'completed' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' :
                    selectedApt.displayStatus === 'cancelled' ? 'bg-gradient-to-br from-slate-400 to-slate-500' :
                    selectedApt.type === 'teleconsult' ? 'bg-gradient-to-br from-purple-400 to-violet-600' :
                    'bg-gradient-to-br from-sky-400 to-blue-600'}
                `}>
                  {selectedApt.date?.split('-')[2] || '০১'}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{selectedApt.doctor}</p>
                  <p className="text-sm text-slate-500">{selectedApt.specialization}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">তারিখ</p>
                  <p className="font-semibold">{formatDate(selectedApt.date)}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">প্রত্যাশিত সময়</p>
                  <p className="font-semibold">{selectedApt.serial_number ? calculateExpectedTime(selectedApt.scheduleStart, selectedApt.serial_number) : selectedApt.time_range}</p>
                </div>
              </div>
              {(selectedApt.status === 'confirmed' || selectedApt.status === 'completed') ? (
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">সিরিয়াল নম্বর</p>
                  <p className="font-semibold font-mono">{selectedApt.serial_number || '-'}</p>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">সিরিয়াল নম্বর</p>
                  <p className="font-semibold text-slate-400">-</p>
                </div>
              )}

              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-500 mb-1">ধরন</p>
                <p className="font-semibold flex items-center gap-2">
                  {selectedApt.type === 'teleconsult' && <Video className="w-4 h-4 text-purple-600" />}
                  {selectedApt.type === 'teleconsult' ? 'ভিডিও কল' : 'সরাসরি ভিজিট'}
                </p>
              </div>

              {selectedApt.reason && (
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-500 mb-1">সমস্যা</p>
                  <p className="font-medium">{selectedApt.reason}</p>
                </div>
              )}

<div className="flex items-center justify-between pt-2">
                 <p className="text-sm text-slate-500">স্ট্যাটাস</p>
                 <StatusPill status={selectedApt.displayStatus as any} />
               </div>

               <div className="pt-4 border-t space-y-3">
                  <Button
                    onClick={() => setShowQRModal(true)}
                    className="w-full"
                  >
                    <Printer className="w-4 h-4 mr-2" /> QR কোড দেখুন ও প্রিন্ট করুন
                  </Button>
                  {(selectedApt.status === 'confirmed' || selectedApt.status === 'completed') && (
                    <Button
                      onClick={() => { setEditInvoiceApt(selectedApt); setEditFeeType(selectedApt.fee_type || 'new'); setEditAdvance(selectedApt.advance || 0); setShowInvoiceEditModal(true); }}
                      className="w-full !bg-emerald-500 hover:!bg-emerald-600"
                    >
                      <Receipt className="w-4 h-4 mr-2" /> ইনভয়েস
                    </Button>
                  )}
                </div>
             </div>
           )}
         </Modal>

         <Modal isOpen={showInvoiceEditModal} onClose={() => { setShowInvoiceEditModal(false); setEditInvoiceApt(null); }} title="ইনভয়েস" size="md">
           {editInvoiceApt && (
             <div className="space-y-5">
               <div className="p-4 bg-sky-50 rounded-xl border border-sky-200">
                 <p className="text-sm text-slate-500 mb-1">ডাক্তার</p>
                 <p className="font-semibold">{editInvoiceApt.doctor}</p>
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

         <Modal isOpen={showQRModal} onClose={() => setShowQRModal(false)} title="অ্যাপয়েন্টমেন্ট স্লিপ" size="md">
           {selectedApt && (
             <div className="space-y-4">
               <AppointmentSlip
                  patientId={selectedApt.patient_id}
                  patientSerial={selectedApt.serial_number}
                  appointmentDate={selectedApt.date}
                  patientName={patientInfo?.name || ''}
                  patientGender={patientInfo?.gender || patientInfo?.sex || ''}
                  patientAge={patientInfo?.age ?? ''}
                  patientPhone={patientInfo?.phone || ''}
                  patientBcode={patientInfo?.bcode || ''}
                   doctorName={selectedApt.doctor || ''}
                   doctorDegree={selectedApt.doctor_degree || ''}
                   doctorDesignation={selectedApt.doctor_designation || ''}
                   doctorSpecialty={selectedApt.doctor_specialty || ''}
                 />
               <Button onClick={handlePrintSlip} className="w-full">প্রিন্ট করুন</Button>
             </div>
           )}
         </Modal>
       </div>
     </DashboardLayout>
  );
}