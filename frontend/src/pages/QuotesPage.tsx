import { zodResolver } from '@hookform/resolvers/zod';
import { Download, Plus, Search, Trash2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { EmptyState, Modal, PageHeader, Skeleton } from '../components/ui';
import { useApiQuery, useDelete, useSave } from '../hooks/useApi';
import { api } from '../services/api';
import type { Client, Paginated, Quote, QuoteStatus } from '../types';
import { isoDate, labelize, money } from '../utils/format';

const statuses: QuoteStatus[] = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'];
const itemSchema = z.object({ description: z.string().min(1, 'Description is required'), quantity: z.coerce.number().positive(), unitPrice: z.coerce.number().nonnegative() });
const quoteSchema = z.object({
  clientId: z.string().min(1), quoteNumber: z.string().min(1), issueDate: z.string(), validUntil: z.string(), currency: z.string().min(3),
  status: z.enum(statuses as [QuoteStatus, ...QuoteStatus[]]), discount: z.coerce.number().nonnegative(), taxRate: z.coerce.number().min(0).max(100),
  notes: z.string().optional(), terms: z.string().optional(), items: z.array(itemSchema).min(1).max(8)
}).refine((value) => value.validUntil >= value.issueDate, { path: ['validUntil'], message: 'Must be after issue date' });
type QuoteForm = z.infer<typeof quoteSchema>;

function daysFromNow(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return isoDate(value.toISOString());
}

export function QuotesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const params = new URLSearchParams({ search, limit: '25' });
  if (status) params.set('status', status);
  const { data, isLoading } = useApiQuery<Paginated<Quote>>(['quotes', search, status], `/quotes?${params}`);
  const clients = useApiQuery<Paginated<Client>>(['clients-options'], '/clients?limit=100');
  const remove = useDelete('/quotes', ['quotes']);

  async function downloadPdf(quote: Quote) {
    const response = await api.get(`/quotes/${quote.id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = response.headers['x-quote-filename'] || `${quote.quoteNumber}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <>
    <PageHeader title="Price Quotes" action={<button className="btn-primary" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={16} /> New Quote</button>} />
    <div className="panel mb-4 flex flex-wrap items-center gap-2 p-3">
      <Search size={16} className="text-slate-500" /><input className="input min-w-64 flex-1 border-0 bg-transparent" placeholder="Search quotes or clients" value={search} onChange={(event) => setSearch(event.target.value)} />
      <select className="input w-44" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
    </div>
    {isLoading ? <Skeleton /> : !data?.items.length ? <EmptyState title="No price quotes found." /> : <div className="panel overflow-x-auto"><table className="w-full min-w-[900px]"><thead><tr><th className="table-th">Quote</th><th className="table-th">Client</th><th className="table-th">Issued</th><th className="table-th">Valid Until</th><th className="table-th">Total</th><th className="table-th">Status</th><th className="table-th"></th></tr></thead><tbody>{data.items.map((item) => <tr key={item.id} className="hover:bg-slate-900/60"><td className="table-td"><button className="font-semibold text-white" onClick={() => { setEditing(item); setOpen(true); }}>{item.quoteNumber}</button><p className="text-xs text-slate-500">{item.items.length} item{item.items.length === 1 ? '' : 's'}</p></td><td className="table-td">{item.client?.company || item.client?.name}</td><td className="table-td">{isoDate(item.issueDate)}</td><td className="table-td">{isoDate(item.validUntil)}</td><td className="table-td font-semibold text-white">{money(item.total, item.currency)}</td><td className="table-td"><span className="rounded bg-slate-800 px-2 py-1 text-xs">{labelize(item.status)}</span></td><td className="table-td"><div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => downloadPdf(item)}><Download size={15} /> PDF</button><button className="btn-secondary" onClick={() => confirm('Delete this quote?') && remove.mutate(item.id)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>}
    {open && <QuoteModal quote={editing} clients={clients.data?.items ?? []} onClose={() => setOpen(false)} />}
  </>;
}

function QuoteModal({ quote, clients, onClose }: { quote: Quote | null; clients: Client[]; onClose: () => void }) {
  const save = useSave<QuoteForm>('/quotes', ['quotes']);
  const { control, register, handleSubmit, formState: { errors } } = useForm<QuoteForm>({ resolver: zodResolver(quoteSchema), defaultValues: quote ? { ...quote, issueDate: isoDate(quote.issueDate), validUntil: isoDate(quote.validUntil), items: quote.items.map(({ description, quantity, unitPrice }) => ({ description, quantity, unitPrice })) } : { clientId: clients[0]?.id || '', quoteNumber: `QT-${Date.now().toString().slice(-6)}`, issueDate: isoDate(), validUntil: daysFromNow(30), currency: 'USD', status: 'DRAFT', discount: 0, taxRate: 0, items: [{ description: '', quantity: 1, unitPrice: 0 }], notes: '', terms: 'Prices are valid until the date shown above.' } });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = useWatch({ control, name: 'items' }) || [];
  const discount = Number(useWatch({ control, name: 'discount' }) || 0);
  const taxRate = Number(useWatch({ control, name: 'taxRate' }) || 0);
  const currency = useWatch({ control, name: 'currency' }) || 'USD';
  const subtotal = watchedItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  const taxable = Math.max(0, subtotal - discount);
  const total = taxable + taxable * taxRate / 100;
  return <Modal title={quote ? 'Edit Price Quote' : 'New Price Quote'} onClose={onClose}>
    <form className="space-y-5" onSubmit={handleSubmit(async (body) => { await save.mutateAsync({ id: quote?.id, body }); onClose(); })}>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Client"><select className="input" {...register('clientId')}>{clients.map((client) => <option key={client.id} value={client.id}>{client.company || client.name}</option>)}</select></Field>
        <Field label="Quote Number"><input className="input" {...register('quoteNumber')} /></Field><Field label="Status"><select className="input" {...register('status')}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Issue Date"><input className="input" type="date" {...register('issueDate')} /></Field><Field label="Valid Until"><input className="input" type="date" {...register('validUntil')} />{errors.validUntil && <p className="mt-1 text-xs text-red-400">{errors.validUntil.message}</p>}</Field><Field label="Currency"><input className="input" {...register('currency')} /></Field>
      </div>
      <div><div className="mb-2 flex items-center justify-between"><p className="label">Quote Items</p><button className="btn-secondary" type="button" disabled={fields.length >= 8} onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}><Plus size={14} /> Add Item</button></div>
        <div className="space-y-2">{fields.map((field, index) => <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_90px_130px_42px]"><input className="input" placeholder="Service or product description" {...register(`items.${index}.description`)} /><input className="input" aria-label="Quantity" placeholder="Qty" type="number" min="0.01" step="0.01" {...register(`items.${index}.quantity`)} /><input className="input" aria-label="Unit price" placeholder="Unit price" type="number" min="0" step="0.01" {...register(`items.${index}.unitPrice`)} /><button className="btn-secondary px-3" type="button" disabled={fields.length === 1} onClick={() => remove(index)} aria-label="Remove item"><X size={15} /></button></div>)}</div>
      </div>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Discount (fixed amount)"><input className="input" type="number" min="0" step="0.01" {...register('discount')} /></Field><Field label="Tax Rate (%)"><input className="input" type="number" min="0" max="100" step="0.01" {...register('taxRate')} /></Field><Field label="Notes"><textarea className="input min-h-20" {...register('notes')} /></Field><Field label="Terms"><textarea className="input min-h-20" {...register('terms')} /></Field></div>
      <div className="ml-auto max-w-xs rounded-md bg-slate-900 p-4 text-sm"><div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{money(subtotal, currency)}</span></div><div className="mt-2 flex justify-between text-lg font-semibold text-white"><span>Total</span><span>{money(total, currency)}</span></div></div>
      {errors.items && <p className="text-sm text-red-400">Please check the quote items.</p>}<button className="btn-primary w-full" disabled={save.isPending || clients.length === 0}>{save.isPending ? 'Saving...' : 'Save Quote'}</button>
    </form>
  </Modal>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label><span className="label mb-1 block">{label}</span>{children}</label>; }
