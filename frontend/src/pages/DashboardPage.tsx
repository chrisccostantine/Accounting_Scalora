import type { ReactElement } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState, PageHeader, Skeleton } from '../components/ui';
import { useApiQuery } from '../hooks/useApi';
import type { Client, Expense, Income } from '../types';
import { labelize, money } from '../utils/format';

interface Dashboard {
  cards: { totalIncome: number; totalExpenses: number; netProfit: number; activeClients: number; collected: number; pending: number; expectedRevenue: number; collectionRate: number; profitMargin: number };
  topClients: { client: string; amount: number }[];
  topExpenseCategories: { category: string; amount: number }[];
  attention: string[];
  recentIncome: Income[];
  recentExpenses: Expense[];
  recentClients: Client[];
  charts: { month: string; income: number; expenses: number; profit: number }[];
}

export function DashboardPage() {
  const { data, isLoading } = useApiQuery<Dashboard>(['dashboard'], '/dashboard');
  if (isLoading) return <Skeleton />;
  if (!data) return <EmptyState title="No dashboard data yet." />;

  const cards = [
    ['Expected Revenue', money(data.cards.expectedRevenue)],
    ['Collected This Month', money(data.cards.collected)],
    ['Pending Payments', money(data.cards.pending)],
    ['Expenses This Month', money(data.cards.totalExpenses)],
    ['Net Profit', money(data.cards.netProfit)],
    ['Active Clients', data.cards.activeClients]
  ];

  return (
    <>
      <PageHeader title="Dashboard" />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value]) => (
          <div className="panel p-5" key={label}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </section>
      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Metric label="Collection Rate" value={`${data.cards.collectionRate.toFixed(0)}%`} />
        <Metric label="Profit Margin" value={`${data.cards.profitMargin.toFixed(0)}%`} />
        <div className="panel p-5">
          <h2 className="mb-3 font-semibold">Needs Attention</h2>
          {data.attention.length ? data.attention.map((item) => <p className="border-t border-slate-800 py-2 text-sm text-slate-300" key={item}>{item}</p>) : <p className="text-sm text-emerald-300">Nothing urgent right now.</p>}
        </div>
      </section>
      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <Chart title="Monthly Profit">
          <AreaChart data={data.charts}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="month" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip /><Area dataKey="profit" stroke="#7C3AED" fill="#7C3AED55" /></AreaChart>
        </Chart>
        <Chart title="Monthly Income vs Expense">
          <BarChart data={data.charts}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="month" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip /><Bar dataKey="income" fill="#2563EB" /><Bar dataKey="expenses" fill="#7C3AED" /></BarChart>
        </Chart>
      </section>
      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        <Recent title="Top Clients This Month" rows={data.topClients.map((item) => [item.client, money(item.amount)])} />
        <Recent title="Top Expense Categories" rows={data.topExpenseCategories.map((item) => [labelize(item.category), money(item.amount)])} />
        <Recent title="Recent Clients" rows={data.recentClients.map((item) => [item.name, labelize(item.status)])} />
      </section>
      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <Recent title="Recent Income" rows={data.recentIncome.map((item) => [item.client?.name ?? 'Client', money(item.amount, item.currency)])} />
        <Recent title="Recent Expenses" rows={data.recentExpenses.map((item) => [item.title, money(item.amount, item.currency)])} />
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="panel p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-white">{value}</p></div>;
}

function Chart({ title, children }: { title: string; children: ReactElement }) {
  return <div className="panel h-80 p-5"><h2 className="mb-4 font-semibold">{title}</h2><ResponsiveContainer width="100%" height="85%">{children}</ResponsiveContainer></div>;
}

function Recent({ title, rows }: { title: string; rows: string[][] }) {
  return <div className="panel p-5"><h2 className="mb-3 font-semibold">{title}</h2>{rows.length ? rows.map((row) => <div key={row.join('-')} className="flex justify-between border-t border-slate-800 py-3 text-sm"><span>{row[0]}</span><span className="text-slate-400">{row[1]}</span></div>) : <p className="text-sm text-slate-500">No records yet.</p>}</div>;
}
