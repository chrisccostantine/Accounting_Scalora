import { useState } from 'react';
import type { ReactElement } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { PageHeader, Skeleton } from '../components/ui';
import { useApiQuery } from '../hooks/useApi';
import type { Client, ExpenseCategory, Paginated } from '../types';
import { labelize, money } from '../utils/format';

interface Reports {
  summary: { monthlyIncome: number; monthlyExpenses: number; monthlyProfit: number; yearlyProfit: number; profitMargin: number; averageMonthlyIncome: number; averageMonthlyExpenses: number };
  incomeByClient: { client: string; amount: number }[];
  expensesByCategory: { category: string; amount: number }[];
  topPayingClients: { client: string; amount: number }[];
  charts: { month: string; income: number; expenses: number; profit: number }[];
  monthlyBreakdown: { month: string; income: number; expenses: number; profit: number; margin: number }[];
}

const colors = ['#2563EB', '#7C3AED', '#14B8A6', '#F59E0B', '#EF4444', '#64748B'];
const categories: ExpenseCategory[] = ['OFFICE', 'SOFTWARE', 'ADS', 'FREELANCER', 'EMPLOYEE', 'INTERNET', 'PHONE', 'TRANSPORTATION', 'EQUIPMENT', 'UTILITIES', 'MARKETING', 'OTHER'];

export function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState('');
  const [clientId, setClientId] = useState('');
  const [category, setCategory] = useState('');
  const clients = useApiQuery<Paginated<Client>>(['clients-options'], '/clients?limit=100');
  const params = new URLSearchParams({ year });
  if (month) params.set('month', month);
  if (clientId) params.set('clientId', clientId);
  if (category) params.set('category', category);
  const { data, isLoading } = useApiQuery<Reports>(['reports', year, month, clientId, category], `/reports?${params.toString()}`);
  return (
    <>
      <PageHeader title="Reports" />
      <div className="panel mb-6 flex flex-wrap gap-3 p-4">
        <input className="input w-32" value={year} onChange={(event) => setYear(event.target.value)} />
        <select className="input w-48" value={month} onChange={(event) => setMonth(event.target.value)}>
          <option value="">Full year</option>
          {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2024, index).toLocaleString('en', { month: 'long' })}</option>)}
        </select>
        <select className="input w-56" value={clientId} onChange={(event) => setClientId(event.target.value)}>
          <option value="">All clients</option>
          {clients.data?.items.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        <select className="input w-56" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">All categories</option>
          {categories.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
        </select>
      </div>
      {isLoading || !data ? <Skeleton /> : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(data.summary).map(([key, value]) => <div className="panel p-5" key={key}><p className="text-sm capitalize text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</p><p className="mt-2 text-2xl font-bold">{key.toLowerCase().includes('margin') ? `${value.toFixed(0)}%` : money(value)}</p></div>)}
          </section>
          <section className="mt-6 grid gap-4 xl:grid-cols-2">
            <Chart title="Income vs Expenses"><BarChart data={data.charts}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="month" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip /><Legend /><Bar dataKey="income" fill="#2563EB" /><Bar dataKey="expenses" fill="#7C3AED" /></BarChart></Chart>
            <Chart title="Income by Client"><BarChart data={data.incomeByClient}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="client" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip /><Bar dataKey="amount" fill="#2563EB" /></BarChart></Chart>
            <Chart title="Expenses by Category"><PieChart><Pie data={data.expensesByCategory} dataKey="amount" nameKey="category" outerRadius={100}>{data.expensesByCategory.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}</Pie><Tooltip /></PieChart></Chart>
            <div className="panel p-5"><h2 className="mb-3 font-semibold">Top Paying Clients</h2>{data.topPayingClients.map((item) => <div className="flex justify-between border-t border-slate-800 py-3 text-sm" key={item.client}><span>{item.client}</span><span>{money(item.amount)}</span></div>)}</div>
          </section>
          <section className="panel mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead><tr><th className="table-th">Month</th><th className="table-th">Income</th><th className="table-th">Expenses</th><th className="table-th">Profit</th><th className="table-th">Margin</th></tr></thead>
              <tbody>{data.monthlyBreakdown.map((item) => <tr key={item.month}><td className="table-td">{item.month}</td><td className="table-td">{money(item.income)}</td><td className="table-td">{money(item.expenses)}</td><td className="table-td">{money(item.profit)}</td><td className="table-td">{item.margin.toFixed(0)}%</td></tr>)}</tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}

function Chart({ title, children }: { title: string; children: ReactElement }) {
  return <div className="panel h-80 p-5"><h2 className="mb-4 font-semibold">{title}</h2><ResponsiveContainer width="100%" height="85%">{children}</ResponsiveContainer></div>;
}
