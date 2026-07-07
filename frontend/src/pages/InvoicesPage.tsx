import { zodResolver } from '@hookform/resolvers/zod';
import { CreditCard, Download, FilePlus2, Plus, Search, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { EmptyState, Modal, PageHeader, Skeleton } from '../components/ui';
import { useApiQuery, useDelete, useSave } from '../hooks/useApi';
import { api } from '../services/api';
import type { Client, Invoice, InvoiceStatus, Paginated, PaymentMethod } from '../types';
import { isoDate, labelize, money } from '../utils/format';

const statuses: InvoiceStatus[] = ['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'];
const methods: PaymentMethod[] = ['CASH', 'BANK', 'WHISH', 'OMT', 'TRANSFER', 'OTHER'];
const invoiceSchema = z.object({ clientId: z.string().min(1), invoiceNumber: z.string().min(1), amount: z.coerce.number().nonnegative(), currency: z.string().default('USD'), issueDate: z.string(), dueDate: z.string(), status: z.enum(statuses as [InvoiceStatus, ...InvoiceStatus[]]), description: z.string().optional(), notes: z.string().optional() });
const paymentSchema = z.object({ amount: z.coerce.number().positive(), currency: z.string().default('USD'), date: z.string(), paymentMethod: z.enum(methods as [PaymentMethod, ...PaymentMethod[]]), referenceNumber: z.string().optional(), notes: z.string().optional() });
type InvoiceForm = z.infer<typeof invoiceSchema>;
type PaymentForm = z.infer<typeof paymentSchema>;

function pdfFilename(invoice: Invoice) {
  const business = invoice.client?.company || invoice.client?.name || invoice.invoiceNumber;
  const sourceDate = invoice.billingPeriodStart || invoice.issueDate;
  const month = new Date(sourceDate).toLocaleString('en', { month: 'long', year: 'numeric' });
  return `${business} - ${month}.pdf`;
}

export function InvoicesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [open, setOpen] = useState(false);
  const params = new URLSearchParams({ search, limit: '25' });
  if (status) params.set('status', status);
  const { data, isLoading } = useApiQuery<Paginated<Invoice>>(['invoices', search, status], `/invoices?${params.toString()}`);
  const clients = useApiQuery<Paginated<Client>>(['clients-options'], '/clients?limit=100');
  const remove = useDelete('/invoices', [['invoices'], ['dashboard'], ['reports']]);
  const queryClient = useQueryClient();

  async function generateCurrentInvoices() {
    await api.post('/invoices/generate', {});
    await Promise.all([queryClient.invalidateQueries({ queryKey: ['invoices'] }), queryClient.invalidateQueries({ queryKey: ['dashboard'] }), queryClient.invalidateQueries({ queryKey: ['reports'] })]);
  }

  async function downloadPdf(invoice: Invoice) {
    const response = await api.get(`/invoices/${invoice.id}/pdf`, { responseType: 'blob' });
    const serverFilename = response.headers['x-invoice-filename'];
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = typeof serverFilename === 'string' ? serverFilename : pdfFilename(invoice);
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader title="Invoices" action={<div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={generateCurrentInvoices}><FilePlus2 size={16} /> Generate This Month</button><button className="btn-primary" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={16} /> New Invoice</button></div>} />
      <div className="panel mb-4 flex flex-wrap items-center gap-2 p-3">
        <Search size={16} className="text-slate-500" />
        <input className="input min-w-64 flex-1 border-0 bg-transparent" placeholder="Search invoices" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input w-44" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
        </select>
      </div>
      {isLoading ? <Skeleton /> : !data?.items.length ? <EmptyState title="No invoices found." /> : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[1040px]">
            <thead><tr><th className="table-th">Invoice</th><th className="table-th">Client</th><th className="table-th">Amount</th><th className="table-th">Paid</th><th className="table-th">Due</th><th className="table-th">Status</th><th className="table-th"></th></tr></thead>
            <tbody>{data.items.map((item) => <tr key={item.id} className="hover:bg-slate-900/60"><td className="table-td"><button className="font-semibold text-white" onClick={() => { setEditing(item); setOpen(true); }}>{item.invoiceNumber}</button><p className="text-xs text-slate-500">{item.autoGenerated ? 'Auto generated' : 'Manual'}{item.billingPeriodStart ? ` - ${isoDate(item.billingPeriodStart)}` : ''}</p></td><td className="table-td">{item.client?.name}</td><td className="table-td">{money(item.amount, item.currency)}</td><td className="table-td">{money(item.paidAmount, item.currency)}</td><td className="table-td">{isoDate(item.dueDate)}</td><td className="table-td"><span className="rounded bg-slate-800 px-2 py-1 text-xs">{labelize(item.computedStatus ?? item.status)}</span></td><td className="table-td"><div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => downloadPdf(item)}><Download size={15} /> PDF</button><button className="btn-secondary" onClick={() => setPaying(item)}><CreditCard size={15} /> Pay</button><button className="btn-secondary" onClick={() => confirm('Delete this invoice?') && remove.mutate(item.id)}><Trash2 size={15} /></button></div></td></tr>)}</tbody>
          </table>
        </div>
      )}
      {open && <InvoiceModal invoice={editing} clients={clients.data?.items ?? []} onClose={() => setOpen(false)} />}
      {paying && <PaymentModal invoice={paying} onClose={() => setPaying(null)} />}
    </>
  );
}

function InvoiceModal({ invoice, clients, onClose }: { invoice: Invoice | null; clients: Client[]; onClose: () => void }) {
  const save = useSave<InvoiceForm>('/invoices', [['invoices'], ['dashboard'], ['reports']]);
  const { register, handleSubmit } = useForm<InvoiceForm>({ resolver: zodResolver(invoiceSchema), defaultValues: invoice ? { ...invoice, issueDate: isoDate(invoice.issueDate), dueDate: isoDate(invoice.dueDate) } : { clientId: clients[0]?.id ?? '', invoiceNumber: `INV-${Date.now().toString().slice(-6)}`, amount: 0, currency: 'USD', issueDate: isoDate(), dueDate: isoDate(), status: 'SENT' } });
  return <Modal title={invoice ? 'Edit Invoice' : 'New Invoice'} onClose={onClose}><form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(async (body) => { await save.mutateAsync({ id: invoice?.id, body }); onClose(); })}><Field label="Client"><select className="input" {...register('clientId')}>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></Field><Field label="Invoice Number"><input className="input" {...register('invoiceNumber')} /></Field><Field label="Amount"><input className="input" type="number" step="0.01" {...register('amount')} /></Field><Field label="Currency"><input className="input" {...register('currency')} /></Field><Field label="Issue Date"><input className="input" type="date" {...register('issueDate')} /></Field><Field label="Due Date"><input className="input" type="date" {...register('dueDate')} /></Field><Field label="Status"><select className="input" {...register('status')}>{statuses.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select></Field><Field label="Description"><input className="input" {...register('description')} /></Field><Field label="Notes"><textarea className="input min-h-24" {...register('notes')} /></Field><button className="btn-primary md:col-span-2" disabled={save.isPending}>Save</button></form></Modal>;
}

function PaymentModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit } = useForm<PaymentForm>({ resolver: zodResolver(paymentSchema), defaultValues: { amount: invoice.outstanding ?? Math.max(0, invoice.amount - invoice.paidAmount), currency: invoice.currency, date: isoDate(), paymentMethod: 'BANK' } });
  return <Modal title={`Record Payment ${invoice.invoiceNumber}`} onClose={onClose}><form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(async (body) => { await api.post(`/invoices/${invoice.id}/payments`, body); await Promise.all([queryClient.invalidateQueries({ queryKey: ['invoices'] }), queryClient.invalidateQueries({ queryKey: ['income'] }), queryClient.invalidateQueries({ queryKey: ['dashboard'] }), queryClient.invalidateQueries({ queryKey: ['reports'] })]); onClose(); })}><Field label="Amount"><input className="input" type="number" step="0.01" {...register('amount')} /></Field><Field label="Currency"><input className="input" {...register('currency')} /></Field><Field label="Date"><input className="input" type="date" {...register('date')} /></Field><Field label="Payment Method"><select className="input" {...register('paymentMethod')}>{methods.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select></Field><Field label="Reference"><input className="input" {...register('referenceNumber')} /></Field><Field label="Notes"><textarea className="input min-h-24" {...register('notes')} /></Field><button className="btn-primary md:col-span-2">Save Payment</button></form></Modal>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label><span className="label mb-1 block">{label}</span>{children}</label>;
}
