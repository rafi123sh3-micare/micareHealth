export type UserRole = 'admin' | 'doctor' | 'patient';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  avatar_url?: string;
  created_at: string;
}

export interface Doctor {
  id: string;
  user_id: string;
  name: string;
  degree: string;
  specialty: string;
  phone: string;
  avatar_url?: string;
  available_days: string[];
  consultation_fee: number;
  zoom_link?: string;
  doctor_code: string;
}

export interface Patient {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  weight: number;
  compliant: string;
  address?: string;
}

export interface DoctorShift {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  type: 'in-person' | 'teleconsult';
  reason?: string;
  notes?: string;
  teleconsult_link?: string;
  created_at: string;
  serial_number?: number;
}

export interface TeleconsultSession {
  id: string;
  appointment_id: string;
  room_url: string;
  status: 'waiting' | 'active' | 'ended';
  started_at?: string;
  ended_at?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'appointment' | 'shift' | 'teleconsult' | 'general';
  is_read: boolean;
  created_at: string;
}

export interface DashboardStats {
  totalAppointments: number;
  completedAppointments: number;
  teleconsultCount: number;
  todayAppointments: number;
}