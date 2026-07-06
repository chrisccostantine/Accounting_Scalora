import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { EmptyState, Modal, PageHeader, Skeleton } from '../components/ui';
import { api } from '../services/api';
import { useApiQuery, useDelete, useSave } from '../hooks/useApi';
import type { OwnerAdvance, Paginated, PaymentMethod } from '../types';
import { isoDate, labelize, money } from '../utils/format';

const methods: PaymentMethod[] = ['CASH', 'BANK', 'WHISH', 'OMT', 'TRANSFER', 'OTHER'];
const optionalNumber = z.preprocess((value) => value === '' ? undefined : value, z.coerce.number().positive().optional());
const advanceSchema = z.object({ title: z.string().min(1), amount: z.coerce.number().nonnegative(), currency: z.string().default('USD'), date: z.string(), source: z.string().optional(), plannedInstallments: optionalNumber, installmentAmount: optionalNumber, nextDueDate: z.string().optional(), notes: z.string().optional() });
const repaymentSchema = z.object({ amount: z.coerce.number().positive(), currency: z.string().default('USD'), date: z.string(), paymentMethod: z.enum(methods as [PaymentMethod, ...PaymentMethod[]]), notes: z.string().optional() });
type AdvanceForm = z.infer<typeof advanceSchema>;
type RepaymentForm = z.infer<typeof repaymentSchema>;

export function AdvancesPage() {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<OwnerAdvance | null>(null);
  const [repaying, setRepaying] = useState<OwnerAdvance | null>(null);
  const [open, setOpen] = useState(false);
  const { data, isLoading, refetch } = useApiQuery<Paginated<OwnerAdvance>>(['advances', search], `/advances?search=${encodeURIComponent(search)}&limit=25`);
  const remove = useDelete('/advances', [['advances'], ['dashboard']]);

  return (
    <>
      <PageHeader title="Owner Advances" action={<button className="btn-primary" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={16} /> New Advance</button>} />
      <div className="panel mb-4 flex items-center gap-2 p-3"><Search size={16} className="text-slate-500" /><input className="input border-0 bg-transparent" placeholder="Search advances" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {isLoading ? <Skeleton /> : !data?.items.length ? <EmptyState title="No owner advances found." /> : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead><tr><th className="table-th">Advance</th><th className="table-th">Original</th><th className="table-th">Repaid</th><th className="table-th">Outstanding</th><th className="table-th">Next Due</th><th className="table-th">Status</th><th className="table-th"></th></tr></thead>
            <tbody>{data.items.map((item) => <tr key={item.id} className="hover:bg-slate-900/60"><td className="table-td"><button className="font-semibold text-white" onClick={() => { setEditing(item); setOpen(true); }}>{item.title}</button><p className="text-xs text-slate-500">{item.source || item.notes}</p></td><td className="table-td">{money(item.amount, item.currency)}</td><td className="table-td">{money(item.repaid, item.currency)}</td><td className="table-td font-semibold">{money(item.outstanding, item.currency)}</td><td className="table-td">{item.nextDueDate ? isoDate(item.nextDueDate) : '-'}</td><td className="table-td">{labelize(item.computedStatus ?? item.status)}</td><td className="table-td text-right"><div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setRepaying(item)}>Repay</button><button className="btn-secondary" onClick={() => confirm('Delete this advance?') && remove.mutate(item.id)}><Trash2 size={15} /></button></div></td></tr>)}</tbody>
          </table>
        </div>
      )}
      {open && <AdvanceModal advance={editing} onClose={() => setOpen(false)} />}
      {repaying && <RepaymentModal advance={repaying} onClose={() => { setRepaying(null); refetch(); }} />}
    </>
  );
}

function AdvanceModal({ advance, onClose }: { advance: OwnerAdvance | null; onClose: () => void }) {
  const save = useSave<AdvanceForm>('/advances', [['advances'], ['dashboard']]);
  const { register, handleSubmit } = useForm<AdvanceForm>({ resolver: zodResolver(advanceSchema), defaultValues: advance ? { ...advance, date: isoDate(advance.date), nextDueDate: advance.nextDueDate ? isoDate(advance.nextDueDate) : undefined } : { amount: 0, currency: 'USD', date: isoDate() } });
  return <Modal title={advance ? 'Edit Advance' : 'New Owner Advance'} onClose={onClose}><form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(async (body) => { await save.mutateAsync({ id: advance?.id, body }); onClose(); })}><Field label="Title"><input className="input" {...register('title')} /></Field><Field label="Amount Paid Personally"><input className="input" type="number" step="0.01" {...register('amount')} /></Field><Field label="Currency"><input className="input" {...register('currency')} /></Field><Field label="Date"><input className="input" type="date" {...register('date')} /></Field><Field label="Source"><input className="input" placeholder="Owner, partner, personal card" {...register('source')} /></Field><Field label="Planned Installments"><input className="input" type="number" {...register('plannedInstallments')} /></Field><Field label="Installment Amount"><input className="input" type="number" step="0.01" {...register('installmentAmount')} /></Field><Field label="Next Due Date"><input className="input" type="date" {...register('nextDueDate')} /></Field><Field label="Notes"><textarea className="input min-h-24" {...register('notes')} /></Field><button className="btn-primary md:col-span-2" disabled={save.isPending}>Save</button></form></Modal>;
}

function RepaymentModal({ advance, onClose }: { advance: OwnerAdvance; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<RepaymentForm>({ resolver: zodResolver(repaymentSchema), defaultValues: { amount: advance.installmentAmount || advance.outstanding, currency: advance.currency, date: isoDate(), paymentMethod: 'BANK' } });
  return <Modal title={`Repay ${advance.title}`} onClose={onClose}><form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(async (body) => { await api.post(`/advances/${advance.id}/repayments`, body); queryClient.invalidateQueries({ queryKey: ['advances'] }); queryClient.invalidateQueries({ queryKey: ['dashboard'] }); onClose(); })}><Field label="Amount"><input className="input" type="number" step="0.01" {...register('amount')} /></Field><Field label="Currency"><input className="input" {...register('currency')} /></Field><Field label="Date"><input className="input" type="date" {...register('date')} /></Field><Field label="Payment Method"><select className="input" {...register('paymentMethod')}>{methods.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select></Field><Field label="Notes"><textarea className="input min-h-24" {...register('notes')} /></Field><button className="btn-primary md:col-span-2" disabled={isSubmitting}>Record Repayment</button></form></Modal>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label><span className="label mb-1 block">{label}</span>{children}</label>;
}
