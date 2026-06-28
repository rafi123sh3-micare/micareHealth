import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const supabaseUrl1 = process.env.NEXT_PUBLIC_SUPABASE_URL1;
const supabaseAnonKey1 = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY1;

export const supabase1 = supabaseUrl1 && supabaseAnonKey1 
  ? createClient(supabaseUrl1, supabaseAnonKey1)
  : supabase;

const FEE_TYPE_PREFIX: Record<string, string> = {
  new: 'N',
  follow_up: 'F',
  report: 'R',
};

export async function generateSerialNumber(doctorId: string, date: string, type: 'appointment' | 'teleconsult', feeType?: string): Promise<string> {
  const [doctorResult, countResult] = await Promise.all([
    supabase.from('doctors').select('doctor_code').eq('id', doctorId).single(),
    supabase.from('appointments').select('id').eq('doctor_id', doctorId).eq('date', date).in('status', ['confirmed', 'completed'])
  ]);

  const doctorCode = doctorResult.data?.doctor_code || 'DR01';
  const typeSuffix = type === 'teleconsult' ? 'T' : 'A';
  const feePrefix = FEE_TYPE_PREFIX[feeType || ''] || '';
  const count = countResult.data?.length || 0;

  return `${doctorCode}-${String(count + 1).padStart(3, '0')}${typeSuffix}${feePrefix}`;
}

export const FEE_TYPES = [
  { value: 'new', label: 'New Patient', amount: 1000 },
  { value: 'follow_up', label: 'Follow Up', amount: 700 },
  { value: 'report', label: 'Report Showing', amount: 0 },
] as const;

export function getFeeAmount(feeType?: string): number {
  const ft = FEE_TYPES.find(f => f.value === feeType);
  return ft?.amount ?? 500;
}

export function getFeeTypePrefix(feeType?: string): string {
  return FEE_TYPE_PREFIX[feeType || ''] || '';
}

export function numberToWords(n: number): string {
  if (n === 0) return 'Zero Taka Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convertUpto999 = (num: number): string => {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + convertUpto999(num % 100) : '');
    return '';
  };
  const convert = (num: number): string => {
    if (num < 1000) return convertUpto999(num);
    if (num < 100000) {
      const th = Math.floor(num / 1000);
      const rem = num % 1000;
      return convertUpto999(th) + ' Thousand' + (rem ? ' ' + convertUpto999(rem) : '');
    }
    return convertUpto999(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + convert(num % 100000) : '');
  };
  let result = '';
  const taka = Math.floor(n);
  const paisa = Math.round((n - taka) * 100);
  if (taka > 0) result += convert(taka) + ' Taka';
  if (paisa > 0) result += ' & ' + convert(paisa) + ' Paisa';
  return result + ' Only';
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
}

export async function generateNextDoctorCode() {
  const { data, error } = await supabase
    .from('doctors')
    .select('doctor_code')
    .order('doctor_code', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return 'DR01';

  const lastCode = data[0].doctor_code;
  if (!lastCode) return 'DR01';
  const numericPart = parseInt(lastCode.replace('DR', ''), 10);
  const nextNum = numericPart + 1;
  return `DR${String(nextNum).padStart(2, '0')}`;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    console.error('Sign in error:', error.message);
  }
  return { data, error };
}

export async function signUp(email: string, password: string, role: string, userData: any) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        name: userData.name,
        phone: userData.phone,
      },
    },
  });

  if (error) {
    console.error('Sign up error:', error.message);
    return { data, error };
  }

  // If email confirmation required, user will be null until confirmed
  if (!data.user) {
    return {
      data,
      error: {
        message: 'আপনার ইমেইলে নিশ্চিতকরণ লিংক পাঠানো হয়েছে। দয়া করে ইমেইল যাচাই করুন।'
      }
    };
  }

  // If doctor, add to doctors table
  if (role === 'doctor') {
    const doctorCode = await generateNextDoctorCode();
    const { error: doctorError } = await supabase.from('doctors').insert([
      {
        user_id: data.user.id,
        name: userData.name,
        phone: userData.phone,
        specialty: userData.specialty || 'General',
        consultation_fee: userData.fee || 500,
        experience: userData.experience || '0 years',
        rating: 4.5,
        review_count: 0,
        is_available: true,
        doctor_code: doctorCode,
      },
    ]);

    if (doctorError) {
      console.error('Error adding doctor:', doctorError.message);
    }
  }

  return { data, error: null };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Sign out error:', error.message);
  }
  return { error };
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Get user error:', error.message);
  }
  return { user, error };
}

export function subscribeToAuth(callback: (user: any) => void) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });

  return () => {
    data.subscription.unsubscribe();
  };
}

// Doctors functions
export async function getDoctors() {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('is_available', true)
    .order('rating', { ascending: false });

  if (error) {
    console.error('Error fetching doctors:', error.message);
    return [];
  }
  return data || [];
}

export async function getDoctorByUserId(userId: string) {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching doctor:', error.message);
    return null;
  }
  return data;
}