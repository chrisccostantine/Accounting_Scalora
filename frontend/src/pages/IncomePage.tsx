import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { EmptyState, Modal, PageHeader, Skeleton } from '../components/ui';
import { useApiQuery, useDelete, useSave } from '../hooks/useApi';
import type { Client, Income, Paginated, PaymentFrequency, PaymentMethod } from '../types';
import { isoDate, labelize, money } from '../utils/format';

const methods: PaymentMethod[] = ['CASH', 'BANK', 'WHISH', 'OMT', 'TRANSFER', 'OTHER'];
const frequencies: PaymentFrequency[] = ['ONE_TIME', 'MONTHLY'];
const schema = z.object({ clientId: z.string().min(1), amount: z.coerce.number().nonnegative(), currency: z.string().default('USD'), date: z.string(), paymentMethod: z.enum(methods as [PaymentMethod, ...PaymentMethod[]]), frequency: z.enum(frequencies as [PaymentFrequency, ...PaymentFrequency[]]), referenceNumber: z.string().optional(), description: z.string().optional(), invoiceNumber: z.string().optional() });
type FormValues = z.infer<typeof schema>;

export function IncomePage() {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Income | null>(null);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useApiQuery<Paginated<Income>>(['income', search], `/income?search=${encodeURIComponent(search)}&limit=25`);
  const clients = useApiQuery<Paginated<Client>>(['clients-options'], '/clients?limit=100');
  const remove = useDelete('/income', [['income'], ['dashboard'], ['reports']]);

  return (
    <>
      <PageHeader title="Income" action={<button className="btn-primary" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={16} /> Add Payment</button>} />
      <div className="panel mb-4 flex items-center gap-2 p-3"><Search size={16} className="text-slate-500" /><input className="input border-0 bg-transparent" placeholder="Search income" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {isLoading ? <Skeleton /> : !data?.items.length ? <EmptyState title="No income records found." /> : (
        <div className="panel overflow-x-auto"><table className="w-full min-w-[980px]"><thead><tr><th className="table-th">Client</th><th className="table-th">Amount</th><th className="table-th">Type</th><th className="table-th">Date</th><th className="table-th">Method</th><th className="table-th">Reference</th><th className="table-th"></th></tr></thead><tbody>{data.items.map((item) => <tr key={item.id} className="hover:bg-slate-900/60"><td className="table-td"><button className="font-semibold text-white" onClick={() => { setEditing(item); setOpen(true); }}>{item.client?.name}</button><p className="text-xs text-slate-500">{item.description}</p></td><td className="table-td">{money(item.amount, item.currency)}</td><td className="table-td">{labelize(item.frequency ?? 'ONE_TIME')}</td><td className="table-td">{isoDate(item.date)}</td><td className="table-td">{labelize(item.paymentMethod)}</td><td className="table-td">{item.referenceNumber || item.invoiceNumber || '-'}</td><td className="table-td text-right"><button className="btn-secondary" onClick={() => confirm('Delete this payment?') && remove.mutate(item.id)}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div>
      )}
      {open && <IncomeModal income={editing} clients={clients.data?.items ?? []} onClose={() => setOpen(false)} />}
    </>
  );
}

function IncomeModal({ income, clients, onClose }: { income: Income | null; clients: Client[]; onClose: () => void }) {
  const save = useSave<FormValues>('/income', [['income'], ['dashboard'], ['reports']]);
  const { register, handleSubmit } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: income ? { ...income, frequency: income.frequency ?? 'ONE_TIME', date: isoDate(income.date) } : { amount: 0, currency: 'USD', date: isoDate(), paymentMethod: 'BANK', frequency: 'ONE_TIME', clientId: clients[0]?.id ?? '' } });
  return <Modal title={income ? 'Edit Income' : 'Add Income'} onClose={onClose}><form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(async (body) => { await save.mutateAsync({ id: income?.id, body }); onClose(); })}><Field label="Client"><select className="input" {...register('clientId')}>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></Field><Field label="Amount"><input className="input" type="number" step="0.01" {...register('amount')} /></Field><Field label="Currency"><input className="input" {...register('currency')} /></Field><Field label="Payment Type"><select className="input" {...register('frequency')}>{frequencies.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select></Field><Field label="Date"><input className="input" type="date" {...register('date')} /></Field><Field label="Payment Method"><select className="input" {...register('paymentMethod')}>{methods.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select></Field><Field label="Reference"><input className="input" {...register('referenceNumber')} /></Field><Field label="Invoice Number"><input className="input" {...register('invoiceNumber')} /></Field><Field label="Description"><textarea className="input min-h-24" {...register('description')} /></Field><button className="btn-primary md:col-span-2" disabled={save.isPending}>Save</button></form></Modal>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label><span className="label mb-1 block">{label}</span>{children}</label>;
}
