'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Video,
  LogOut, 
  Menu,
  PlusCircle,
  ChevronRight,
  TrendingUp,
  Info,
  User
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
// import { Footer } from './Footer';
import { useLoading } from '@/context/LoadingContext';
import { Skeleton, ContentSkeleton } from './ui/Skeleton';
import toast from 'react-hot-toast';

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  color: string;
};

type NavItems = {
  admin: NavItem[];
  doctor: NavItem[];
  patient: NavItem[];
};

const NAV_ITEMS: NavItems = {
  admin: [
    { href: '/dashboard/admin', label: 'ড্যাশবোর্ড', icon: LayoutDashboard, color: 'from-blue-500 to-cyan-500' },
    { href: '/dashboard/admin/doctors', label: 'ডাক্তার তালিকা', icon: Users, color: 'from-emerald-500 to-teal-500' },
    { href: '/dashboard/admin/appointments', label: 'অ্যাপয়েন্টমেন্ট', icon: Calendar, color: 'from-orange-500 to-amber-500' },
    { href: '/dashboard/admin/reports', label: 'রিপোর্ট', icon: TrendingUp, color: 'from-amber-500 to-orange-500' },
    { href: '/dashboard/admin/about', label: 'About', icon: Info, color: 'from-slate-500 to-slate-600' },
  ],
  doctor: [
    { href: '/dashboard/doctor', label: 'আজকের দিন', icon: LayoutDashboard, color: 'from-emerald-500 to-cyan-500' },
    { href: '/dashboard/doctor/appointments', label: 'অ্যাপয়েন্টমেন্ট', icon: Calendar, color: 'from-orange-500 to-amber-500' },
    { href: '/dashboard/doctor/reports', label: 'রিপোর্ট', icon: TrendingUp, color: 'from-amber-500 to-orange-500' },
  ],
  patient: [
    { href: '/dashboard/patient', label: 'হোম', icon: LayoutDashboard, color: 'from-cyan-500 to-blue-500' },
    { href: '/dashboard/patient/book', label: 'অ্যাপয়েন্টমেন্ট বুক', icon: PlusCircle, color: 'from-teal-500 to-emerald-500' },
    { href: '/dashboard/patient/appointments', label: 'আমার অ্যাপয়েন্টমেন্ট', icon: Calendar, color: 'from-indigo-500 to-violet-500' },
    { href: '/dashboard/patient/doctors', label: 'সকল ডাক্তার', icon: Users, color: 'from-amber-500 to-orange-500' },
    { href: '/dashboard/patient/teleconsult', label: 'টেলিকনসাল্ট', icon: Video, color: 'from-purple-500 to-pink-500' },
  ],
};

export default function DashboardLayout({ 
  children, 
  role 
}: { 
  children: React.ReactNode; 
  role: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isLoading, startLoading, stopLoading } = useLoading();

  useEffect(() => {
    stopLoading();
  }, [pathname, stopLoading]);

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    const hasData = 
      (role === 'admin' && localStorage.getItem('adminData')) ||
      (role === 'doctor' && localStorage.getItem('doctorData')) ||
      (role === 'patient' && localStorage.getItem('patientData'));
    
    if (!userRole || !hasData) {
      toast.error('লগইন করুন');
      router.push('/login');
    }
  }, [role, router]);

  const handleNavClick = useCallback((href: string) => {
    startLoading();
    setSidebarOpen(false);
    router.push(href);
  }, [router, startLoading]);

  const getNavItems = (userRole: string): NavItem[] => {
    switch (userRole) {
      case 'admin': return NAV_ITEMS.admin;
      case 'doctor': return NAV_ITEMS.doctor;
      case 'patient': return NAV_ITEMS.patient;
      default: return NAV_ITEMS.patient;
    }
  };

  const items = getNavItems(role);
  const [userData, setUserData] = useState<{ name: string; role: string; id: string }>({ name: role === 'admin' ? 'অ্যাডমিন' : role === 'doctor' ? 'ডাক্তার' : 'রোগী', role, id: '' });

  useEffect(() => {
    let name = role === 'admin' ? 'অ্যাডমিন' : '';
    let id = '';
    
    if (role === 'doctor') {
      const docData = JSON.parse(localStorage.getItem('doctorData') || '{}');
      name = docData.name || 'ডাক্তার';
      id = docData.id || '';
    } else if (role === 'patient') {
      const patData = JSON.parse(localStorage.getItem('patientData') || '{}');
      name = patData.name || 'রোগী';
      id = patData.id || '';
    } else if (role === 'admin') {
      const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
      id = adminData.id || '';
    }
    
    setUserData({ name, role, id });
  }, [role]);

  const handleSignOut = async () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('doctorData');
    localStorage.removeItem('patientData');
    router.push('/login');
  };

  const getInitial = (name: string) => {
    if (!name) return role === 'admin' ? 'অ' : role === 'doctor' ? 'ড' : 'র';
    return name.charAt(0);
  };

  const getRoleBadgeColor = () => {
    switch(role) {
      case 'admin': return 'bg-gradient-to-r from-blue-500 to-cyan-500';
      case 'doctor': return 'bg-gradient-to-r from-emerald-500 to-teal-500';
      default: return 'bg-gradient-to-r from-violet-500 to-purple-500';
    }
  };

  const getRoleLabel = () => {
    switch(role) {
      case 'admin': return 'অ্যাডমিন';
      case 'doctor': return 'ডাক্তার';
      default: return 'রোগী';
    }
  };

  return (
    <div className="min-h-screen premium-bg pb-20 xl:pb-0">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-slate-200/60 z-50 h-16 shadow-sm">
        <div className="flex items-center justify-between px-4 h-full max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2.5 rounded-xl hover:bg-slate-100 xl:hidden"
            >
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <Link href={`/dashboard/${role}`} className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 via-primary-600 to-blue-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
                <span className="text-white font-bold text-sm">CC</span>
              </div>
              <div className="hidden sm:block">
                <span className="font-bold text-slate-900">Clinic Connect</span>
                <p className="text-[10px] text-slate-400 -mt-0.5">Healthcare Management</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {userData.id && (
              <NotificationBell role={role as 'patient' | 'doctor' | 'admin'} userId={userData.id} />
            )}
            <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-slate-50/80 rounded-full border border-slate-200/50">
              <Link href={`/dashboard/${role}/profile`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-medium shadow-sm">
                  {getInitial(userData.name)}
                </div>
                <span className="text-sm font-medium text-slate-700">{userData.name}</span>
              </Link>
            </div>
            <button 
              onClick={handleSignOut} 
              className="p-2.5 rounded-xl hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-slate-200/60 z-40 hidden xl:block">
        {/* Sidebar Header */}
        <div className="pt-4 px-4 pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>নেভিগেশন</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        </div>

        {/* Navigation - Scrollable */}
        <div className="px-3 py-2 overflow-y-auto" style={{ height: 'calc(100% - 70px)' }}>
          <nav className="space-y-1.5 pb-16">
            {items.map((item) => {
              const isActive = pathname === item.href;
              const gradientColors = item.color || 'from-slate-500 to-slate-600';
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => handleNavClick(item.href)}
                  className={`
                    group relative flex items-center gap-3 px-4 py-3 rounded-2xl 
                    transition-all duration-200 ease-out
                    ${isActive 
                      ? 'bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-100/50' 
                      : 'hover:bg-slate-50'
                    }
                  `}
                >
                  {isActive && (
                    <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b ${gradientColors}`} />
                  )}
                  
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center shadow-md
                    transition-all duration-300 group-hover:scale-110
                    ${isActive 
                      ? `bg-gradient-to-br ${gradientColors} text-white shadow-lg` 
                      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                    }
                  `}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1">
                    <span className={`
                      font-medium block transition-colors
                      ${isActive ? 'text-primary-700' : 'text-slate-600 group-hover:text-slate-900'}
                    `}>
                      {item.label}
                    </span>
                  </div>

                  <ChevronRight className={`
                    w-4 h-4 transition-all duration-300
                    ${isActive ? 'text-primary-400' : 'text-slate-300 opacity-0 group-hover:opacity-100'}
                  `} />
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile Card - Fixed at very bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-white border-t border-slate-100">
          <Link 
            href={`/dashboard/${role}/profile`} 
            className="flex items-center gap-3 p-3 bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-100 shadow-sm hover:opacity-80 transition-opacity"
          >
            <div className={`
              w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shadow
              ${role === 'admin' ? 'bg-gradient-to-br from-blue-500 to-cyan-500' : 
                role === 'doctor' ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 
                'bg-gradient-to-br from-violet-500 to-purple-500'}
            `}>
              {getInitial(userData.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 text-sm truncate">{userData.name}</p>
              <span className={`
                inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white
                ${getRoleBadgeColor()}
              `}>
                {getRoleLabel()}
              </span>
            </div>
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSignOut();
              }}
              className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              title="লগআউট"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </Link>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <aside className={`
        xl:hidden fixed inset-y-0 left-0 w-72 bg-white z-50 
        transform transition-transform duration-300 ease-out shadow-2xl
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Mobile Sidebar Header */}
        <div className="pt-6 px-4 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-sm">CC</span>
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Clinic Connect</span>
                <span className="text-[10px] text-slate-400">Healthcare Management</span>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl">
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation Header */}
        <div className="pt-4 px-4 pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>নেভিগেশন</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="px-4 py-4 space-y-1">
          {items.map((item) => {
            const isActive = pathname === item.href;
            const gradientColors = item.color || 'from-slate-500 to-slate-600';
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => handleNavClick(item.href)}
                className={`
                  group flex items-center gap-3 px-4 py-3.5 rounded-2xl 
                  transition-all duration-200
                  ${isActive 
                    ? 'bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-100/50' 
                    : 'hover:bg-slate-50'
                  }
                `}
              >
                <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center
                    ${isActive 
                      ? `bg-gradient-to-br ${gradientColors} text-white shadow-lg` 
                      : 'bg-slate-100 text-slate-500'
                    }
                  `}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className={`font-medium ${isActive ? 'text-primary-700' : 'text-slate-600'}`}>
                    {item.label}
                  </span>
                  {isActive && (
                    <ChevronRight className="w-4 h-4 text-primary-400 ml-auto" />
                  )}
                </Link>
            );
          })}
        </nav>

        {/* Mobile Sidebar Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 bg-white">
          <Link 
            href={`/dashboard/${role}/profile`}
            className="block p-4 bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-100"
          >
            <div className="flex items-center gap-3">
              <div className={`
                w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold
                ${role === 'admin' ? 'bg-gradient-to-br from-blue-500 to-cyan-500' : 
                  role === 'doctor' ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 
                  'bg-gradient-to-br from-violet-500 to-purple-500'}
              `}>
                {getInitial(userData.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{userData.name}</p>
                <span className={`
                  inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full text-white
                  ${getRoleBadgeColor()}
                `}>
                  {getRoleLabel()}
                </span>
              </div>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSignOut();
                }}
                className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-colors"
                title="লগআউট"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </Link>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 xl:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="pt-16 min-h-screen page-enter xl:pl-64">
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {isLoading ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton width={200} height={32} className="rounded-lg" />
                  <Skeleton width={300} height={16} />
                </div>
                <Skeleton width={120} height={40} className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white rounded-2xl shadow-card border border-slate-100/50 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <Skeleton variant="circular" width={40} height={40} />
                      <Skeleton width="40%" height={14} />
                    </div>
                    <Skeleton width="50%" height={32} className="mb-1" />
                    <Skeleton width="30%" height={12} />
                  </div>
                ))}
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                <Skeleton width="100%" height={300} className="rounded-2xl" />
                <Skeleton width="100%" height={300} className="rounded-2xl" />
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className={`fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/60 z-50 xl:hidden safe-area-pb shadow-lg transition-all duration-300 ${sidebarOpen ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
        <div className="flex items-center justify-around px-2 py-2">
          {items.slice(0, 5).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => handleNavClick(item.href)}
                className="flex flex-col items-center gap-1 px-2 py-2 rounded-xl min-w-[60px] transition-all"
              >
                <div className={`
                  p-2 rounded-xl transition-all duration-300
                  ${isActive ? `bg-gradient-to-br ${item.color} shadow-lg` : 'bg-slate-100'}
                `}>
                  {isActive ? (
                    <item.icon className="w-5 h-5 text-white" />
                  ) : (
                    <item.icon className="w-5 h-5 text-slate-500" />
                  )}
                </div>
                <span className={`text-[10px] font-medium ${isActive ? 'text-primary-600' : 'text-slate-400'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <style jsx global>{`
        .safe-area-pb {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
      `}</style>
      
      {/* <Footer /> */}
    </div>
  );
}