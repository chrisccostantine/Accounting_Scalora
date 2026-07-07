import type { ReactElement } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState, PageHeader, Skeleton } from '../components/ui';
import { useApiQuery } from '../hooks/useApi';
import type { ActivityLog, Client, Expense, Income, Invoice } from '../types';
import { isoDate, labelize, money } from '../utils/format';

interface Dashboard {
  cards: { totalIncome: number; totalExpenses: number; netProfit: number; activeClients: number; collected: number; pending: number; expectedRevenue: number; collectionRate: number; profitMargin: number; ownerAdvanceOutstanding: number; invoicedRevenue: number; invoiceCollected: number };
  topClients: { client: string; amount: number }[];
  topExpenseCategories: { category: string; amount: number }[];
  attention: string[];
  openInvoices: Invoice[];
  activity: ActivityLog[];
  recentIncome: Income[];
  recentExpenses: Expense[];
  recentClients: Client[];
  charts: { month: string; income: number; expenses: number; profit: number }[];
}

export function DashboardPage() {
  const { data, isLoading } = useApiQuery<Dashboard>(['dashboard'], '/dashboard');
  if (isLoading) return <Skeleton />;
  if (!data) return <EmptyState title="No dashboard data yet." />;

  const supportCards = [
    ['Invoices Sent', money(data.cards.invoicedRevenue), 'Total billed to clients this month'],
    ['Still Unpaid', money(data.cards.pending), 'Invoices/payments not collected yet'],
    ['Active Clients', String(data.cards.activeClients), 'Clients currently marked active'],
    ['Owner Money Owed', money(data.cards.ownerAdvanceOutstanding), 'Money the business still owes you']
  ];

  return (
    <>
      <PageHeader title="Dashboard" />
      <section className="grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
        <MoneyCard label="Made This Month" value={money(data.cards.collected)} note="Money received from clients" tone="income" />
        <Operator value="-" />
        <MoneyCard label="Paid This Month" value={money(data.cards.totalExpenses)} note="Business expenses paid" tone="expense" />
        <Operator value="=" />
        <MoneyCard label="Profit This Month" value={money(data.cards.netProfit)} note={data.cards.netProfit >= 0 ? 'You are ahead this month' : 'You spent more than you made'} tone={data.cards.netProfit >= 0 ? 'profit' : 'loss'} />
      </section>
      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {supportCards.map(([label, value, note]) => <SmallCard key={label} label={label} value={value} note={note} />)}
      </section>
      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_2fr]">
        <Metric label="Collected From Expected" value={`${data.cards.collectionRate.toFixed(0)}%`} note={`${money(data.cards.collected)} received from ${money(data.cards.expectedRevenue)} expected`} />
        <Metric label="Profit Margin" value={`${data.cards.profitMargin.toFixed(0)}%`} note="Profit compared to money received" />
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
        <Recent title="Open Invoices" rows={data.openInvoices.map((item) => [item.invoiceNumber, `${item.client?.name ?? 'Client'} - ${money(item.outstanding ?? 0, item.currency)} due ${isoDate(item.dueDate)}`])} />
        <Recent title="Latest Activity" rows={data.activity.map((item) => [item.title, labelize(item.action)])} />
      </section>
      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <Recent title="Recent Income" rows={data.recentIncome.map((item) => [item.client?.name ?? 'Client', money(item.amount, item.currency)])} />
        <Recent title="Recent Expenses" rows={data.recentExpenses.map((item) => [item.title, money(item.amount, item.currency)])} />
      </section>
    </>
  );
}

function MoneyCard({ label, value, note, tone }: { label: string; value: string; note: string; tone: 'income' | 'expense' | 'profit' | 'loss' }) {
  const tones = {
    income: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    expense: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
    profit: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
    loss: 'border-amber-500/40 bg-amber-500/10 text-amber-200'
  };
  return <div className={`rounded-md border p-6 ${tones[tone]}`}><p className="text-sm font-semibold uppercase tracking-wide text-slate-300">{label}</p><p className="mt-3 text-3xl font-bold text-white xl:text-4xl">{value}</p><p className="mt-2 text-sm text-slate-400">{note}</p></div>;
}

function Operator({ value }: { value: string }) {
  return <div className="hidden min-w-10 items-center justify-center text-3xl font-bold text-slate-600 lg:flex">{value}</div>;
}

function SmallCard({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="panel p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></div>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="panel p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></div>;
}

function Chart({ title, children }: { title: string; children: ReactElement }) {
  return <div className="panel h-80 p-5"><h2 className="mb-4 font-semibold">{title}</h2><ResponsiveContainer width="100%" height="85%">{children}</ResponsiveContainer></div>;
}

function Recent({ title, rows }: { title: string; rows: string[][] }) {
  return <div className="panel p-5"><h2 className="mb-3 font-semibold">{title}</h2>{rows.length ? rows.map((row) => <div key={row.join('-')} className="flex justify-between border-t border-slate-800 py-3 text-sm"><span>{row[0]}</span><span className="text-slate-400">{row[1]}</span></div>) : <p className="text-sm text-slate-500">No records yet.</p>}</div>;
}
