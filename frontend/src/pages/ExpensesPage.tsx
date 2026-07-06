import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { EmptyState, Modal, PageHeader, Skeleton } from '../components/ui';
import { useApiQuery, useDelete, useSave } from '../hooks/useApi';
import type { Expense, ExpenseCategory, Paginated, PaymentFrequency, PaymentMethod } from '../types';
import { isoDate, labelize, money } from '../utils/format';

const methods: PaymentMethod[] = ['CASH', 'BANK', 'WHISH', 'OMT', 'TRANSFER', 'OTHER'];
const frequencies: PaymentFrequency[] = ['ONE_TIME', 'MONTHLY', 'YEARLY'];
const categories: ExpenseCategory[] = ['OFFICE', 'SOFTWARE', 'ADS', 'FREELANCER', 'EMPLOYEE', 'INTERNET', 'PHONE', 'TRANSPORTATION', 'EQUIPMENT', 'UTILITIES', 'MARKETING', 'OTHER'];
const schema = z.object({ title: z.string().min(1), amount: z.coerce.number().nonnegative(), currency: z.string().default('USD'), category: z.enum(categories as [ExpenseCategory, ...ExpenseCategory[]]), paymentMethod: z.enum(methods as [PaymentMethod, ...PaymentMethod[]]), frequency: z.enum(frequencies as [PaymentFrequency, ...PaymentFrequency[]]), date: z.string(), vendor: z.string().optional(), receiptNumber: z.string().optional(), notes: z.string().optional() });
type FormValues = z.infer<typeof schema>;

export function ExpensesPage() {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Expense | null>(null);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useApiQuery<Paginated<Expense>>(['expenses', search], `/expenses?search=${encodeURIComponent(search)}&limit=25`);
  const remove = useDelete('/expenses', [['expenses'], ['dashboard'], ['reports']]);
  return (
    <>
      <PageHeader title="Expenses" action={<button className="btn-primary" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={16} /> Add Expense</button>} />
      <div className="panel mb-4 flex items-center gap-2 p-3"><Search size={16} className="text-slate-500" /><input className="input border-0 bg-transparent" placeholder="Search expenses" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {isLoading ? <Skeleton /> : !data?.items.length ? <EmptyState title="No expense records found." /> : (
        <div className="panel overflow-x-auto"><table className="w-full min-w-[980px]"><thead><tr><th className="table-th">Title</th><th className="table-th">Amount</th><th className="table-th">Type</th><th className="table-th">Category</th><th className="table-th">Date</th><th className="table-th">Vendor</th><th className="table-th"></th></tr></thead><tbody>{data.items.map((item) => <tr key={item.id} className="hover:bg-slate-900/60"><td className="table-td"><button className="font-semibold text-white" onClick={() => { setEditing(item); setOpen(true); }}>{item.title}</button><p className="text-xs text-slate-500">{labelize(item.paymentMethod)}</p></td><td className="table-td">{money(item.amount, item.currency)}</td><td className="table-td">{labelize(item.frequency ?? 'ONE_TIME')}</td><td className="table-td">{labelize(item.category)}</td><td className="table-td">{isoDate(item.date)}</td><td className="table-td">{item.vendor || '-'}</td><td className="table-td text-right"><button className="btn-secondary" onClick={() => confirm('Delete this expense?') && remove.mutate(item.id)}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div>
      )}
      {open && <ExpenseModal expense={editing} onClose={() => setOpen(false)} />}
    </>
  );
}

function ExpenseModal({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const save = useSave<FormValues>('/expenses', [['expenses'], ['dashboard'], ['reports']]);
  const { register, handleSubmit } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: expense ? { ...expense, frequency: expense.frequency ?? 'ONE_TIME', date: isoDate(expense.date) } : { amount: 0, currency: 'USD', date: isoDate(), category: 'SOFTWARE', paymentMethod: 'BANK', frequency: 'ONE_TIME' } });
  return <Modal title={expense ? 'Edit Expense' : 'Add Expense'} onClose={onClose}><form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(async (body) => { await save.mutateAsync({ id: expense?.id, body }); onClose(); })}><Field label="Title"><input className="input" {...register('title')} /></Field><Field label="Amount"><input className="input" type="number" step="0.01" {...register('amount')} /></Field><Field label="Currency"><input className="input" {...register('currency')} /></Field><Field label="Payment Type"><select className="input" {...register('frequency')}>{frequencies.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select></Field><Field label="Category"><select className="input" {...register('category')}>{categories.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select></Field><Field label="Payment Method"><select className="input" {...register('paymentMethod')}>{methods.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select></Field><Field label="Date"><input className="input" type="date" {...register('date')} /></Field><Field label="Vendor"><input className="input" {...register('vendor')} /></Field><Field label="Receipt Number"><input className="input" {...register('receiptNumber')} /></Field><Field label="Notes"><textarea className="input min-h-24" {...register('notes')} /></Field><button className="btn-primary md:col-span-2" disabled={save.isPending}>Save</button></form></Modal>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label><span className="label mb-1 block">{label}</span>{children}</label>;
}
