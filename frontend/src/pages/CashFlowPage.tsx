import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader, Skeleton } from '../components/ui';
import { useApiQuery } from '../hooks/useApi';
import { money } from '../utils/format';

interface CashFlowReport {
  cashFlow: { month: string; inflow: number; outflow: number; net: number; closingCash: number }[];
}

export function CashFlowPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const { data, isLoading } = useApiQuery<CashFlowReport>(['cash-flow', year], `/reports?year=${year}`);
  return (
    <>
      <PageHeader title="Cash Flow" action={<input className="input w-32" value={year} onChange={(event) => setYear(event.target.value)} />} />
      {isLoading || !data ? <Skeleton /> : (
        <>
          <section className="panel h-80 p-5">
            <h2 className="mb-4 font-semibold">Closing Cash Trend</h2>
            <ResponsiveContainer width="100%" height="85%"><AreaChart data={data.cashFlow}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="month" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip /><Area dataKey="closingCash" stroke="#14B8A6" fill="#14B8A655" /></AreaChart></ResponsiveContainer>
          </section>
          <section className="panel mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px]"><thead><tr><th className="table-th">Month</th><th className="table-th">Inflow</th><th className="table-th">Outflow</th><th className="table-th">Net</th><th className="table-th">Closing Cash</th></tr></thead><tbody>{data.cashFlow.map((item) => <tr key={item.month}><td className="table-td">{item.month}</td><td className="table-td">{money(item.inflow)}</td><td className="table-td">{money(item.outflow)}</td><td className="table-td">{money(item.net)}</td><td className="table-td">{money(item.closingCash)}</td></tr>)}</tbody></table>
          </section>
        </>
      )}
    </>
  );
}
