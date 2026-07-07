import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BarChart3, CreditCard, FileClock, Files, HandCoins, LayoutDashboard, LogOut, ReceiptText, ScrollText, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/income', label: 'Income', icon: CreditCard },
  { to: '/expenses', label: 'Expenses', icon: ReceiptText },
  { to: '/invoices', label: 'Invoices', icon: ScrollText },
  { to: '/advances', label: 'Advances', icon: HandCoins },
  { to: '/cash-flow', label: 'Cash Flow', icon: TrendingUp },
  { to: '/attachments', label: 'Files', icon: Files },
  { to: '/activity', label: 'Activity', icon: FileClock },
  { to: '/reports', label: 'Reports', icon: BarChart3 }
];

export function AppShell() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#05070b] text-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-800 bg-black px-4 py-5 lg:block">
        <div className="mb-8 px-2">
          <p className="text-xl font-bold text-white">Scalora</p>
          <p className="text-sm text-slate-500">Accounting ERP</p>
        </div>
        <nav className="space-y-1">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-scalora-blue text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}>
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="lg:pl-64">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-black/80 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex gap-2 overflow-x-auto lg:hidden">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `rounded-md p-2 ${isActive ? 'bg-scalora-blue' : 'bg-slate-900'}`} aria-label={item.label}>
                <item.icon size={18} />
              </NavLink>
            ))}
          </div>
          <div className="hidden lg:block">
            <p className="text-sm text-slate-500">Private workspace</p>
          </div>
          <button className="btn-secondary" onClick={() => { logout(); navigate('/login'); }}>
            <LogOut size={16} /> Logout
          </button>
        </header>
        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
