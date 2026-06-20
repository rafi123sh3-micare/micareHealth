'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Calendar, Clock, Video, X, ChevronRight, FileText, Search, Printer } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { QRCode } from '@/components/ui/QRCode';
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
  const [showQRModal, setShowQRModal] = useState(false);

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
        .select('*, doctors(name, specialization)')
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
          const aStatus = a.displayStatus;
          const bStatus = b.displayStatus;
          return (statusOrder[aStatus] || 99) - (statusOrder[bStatus] || 99);
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
    return date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
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

                <div className="flex items-center justify-end mt-3 text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-sm font-medium">বিস্তারিত</span>
                  <ChevronRight className="w-4 h-4" />
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

               <div className="pt-4 border-t">
                 <Button
                   onClick={() => setShowQRModal(true)}
                   className="w-full"
                 >
                   <Printer className="w-4 h-4 mr-2" /> QR কোড দেখুন ও প্রিন্ট করুন
                 </Button>
               </div>
             </div>
           )}
         </Modal>

         {/* QR CODE MODAL */}
         <Modal
           isOpen={showQRModal}
           onClose={() => setShowQRModal(false)}
           title="অ্যাপয়েন্টমেন্ট QR কোড"
           size="sm"
         >
           {selectedApt && (
             <div className="space-y-4 text-center">
               <div className="flex justify-center">
                 <QRCode value={`${window.location.origin}/dashboard/patient/appointments?id=${selectedApt.id}`} size={200} />
               </div>
                <div className="space-y-2">
                  <p className="font-semibold">{selectedApt.doctor}</p>
                  <p className="text-sm text-slate-500">{formatDate(selectedApt.date)}</p>
                   <p className="text-sm text-slate-500">প্রত্যাশিত সময়: <span className="font-mono font-semibold text-primary-600">{selectedApt.serial_number ? calculateExpectedTime(selectedApt.scheduleStart, selectedApt.serial_number) : selectedApt.time_range}</span></p>
                </div>
               <Button
                 onClick={() => {
                   const printWindow = window.open('', '_blank');
                   if (printWindow) {
                     printWindow.document.write(`
                       <html>
                         <head>
                           <title>অ্যাপয়েন্টমেন্ট QR কোড</title>
                           <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
                           <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
                           <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
                         </head>
                         <body style="text-align:center;padding:20px;">
                           <h2>ক্লিনিক কানেক্ট - অ্যাপয়েন্টমেন্ট</h2>
                           <p>ডাক্তার: ${selectedApt.doctor}</p>
                           <p>তারিখ: ${formatDate(selectedApt.date)}</p>
                            <p>সময়: ${selectedApt.serial_number ? calculateExpectedTime(selectedApt.scheduleStart, selectedApt.serial_number) : selectedApt.time_range}</p>
                           <div id="qrcode"></div>
                           <script type="text/babel">
                             const QrCode = window.QRCodeSVG.default || window.QRCodeSVG;
                             ReactDOM.render(
                               React.createElement(QrCode, {
                                 value: '${window.location.origin}/dashboard/patient/appointments?id=${selectedApt.id}',
                                 size: 200
                               }),
                               document.getElementById('qrcode')
                             );
                           </script>
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
       </div>
     </DashboardLayout>
  );
}