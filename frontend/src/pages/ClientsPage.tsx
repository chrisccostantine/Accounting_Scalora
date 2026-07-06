import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { EmptyState, Modal, PageHeader, Skeleton } from '../components/ui';
import { useApiQuery, useDelete, useSave } from '../hooks/useApi';
import type { Client, ClientService, ClientStatus, Paginated, PaymentFrequency } from '../types';
import { isoDate, labelize, money } from '../utils/format';

const services: ClientService[] = ['META_ADS', 'TIKTOK_ADS', 'GOOGLE_ADS', 'SOCIAL_MEDIA_MANAGEMENT', 'CONTENT_CREATION', 'SHOPIFY_STORE', 'WEBSITE_DEVELOPMENT', 'WEB_APPLICATION', 'MOBILE_APPLICATION', 'BRANDING', 'OTHER'];
const statuses: ClientStatus[] = ['ACTIVE', 'PAUSED', 'COMPLETED'];
const frequencies: PaymentFrequency[] = ['ONE_TIME', 'MONTHLY', 'YEARLY'];
const schema = z.object({ name: z.string().min(1), company: z.string().optional(), phone: z.string().optional(), email: z.string().optional(), service: z.enum(services as [ClientService, ...ClientService[]]), monthlyFee: z.coerce.number().nonnegative(), billingFrequency: z.enum(frequencies as [PaymentFrequency, ...PaymentFrequency[]]), currency: z.string().default('USD'), status: z.enum(statuses as [ClientStatus, ...ClientStatus[]]), contractStartDate: z.string(), notes: z.string().optional() });
type FormValues = z.infer<typeof schema>;

export function ClientsPage() {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useApiQuery<Paginated<Client>>(['clients', search], `/clients?search=${encodeURIComponent(search)}&limit=25`);
  const remove = useDelete('/clients', [['clients'], ['dashboard'], ['reports']]);

  return (
    <>
      <PageHeader title="Clients" action={<button className="btn-primary" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={16} /> New Client</button>} />
      <div className="panel mb-4 flex items-center gap-2 p-3"><Search size={16} className="text-slate-500" /><input className="input border-0 bg-transparent" placeholder="Search clients" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {isLoading ? <Skeleton /> : !data?.items.length ? <EmptyState title="No clients found." /> : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead><tr><th className="table-th">Name</th><th className="table-th">Service</th><th className="table-th">Fee</th><th className="table-th">Billing</th><th className="table-th">Status</th><th className="table-th">Contact</th><th className="table-th"></th></tr></thead>
            <tbody>{data.items.map((client) => <tr key={client.id} className="hover:bg-slate-900/60"><td className="table-td"><button className="font-semibold text-white" onClick={() => { setEditing(client); setOpen(true); }}>{client.name}</button><p className="text-xs text-slate-500">{client.company}</p></td><td className="table-td">{labelize(client.service)}</td><td className="table-td">{money(client.monthlyFee, client.currency)}</td><td className="table-td">{labelize(client.billingFrequency ?? 'MONTHLY')}</td><td className="table-td">{labelize(client.status)}</td><td className="table-td">{client.email || client.phone || '-'}</td><td className="table-td text-right"><button className="btn-secondary" onClick={() => confirm('Delete this client?') && remove.mutate(client.id)}><Trash2 size={15} /></button></td></tr>)}</tbody>
          </table>
        </div>
      )}
      {open && <ClientModal client={editing} onClose={() => setOpen(false)} />}
    </>
  );
}

function ClientModal({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const save = useSave<FormValues>('/clients', [['clients'], ['dashboard'], ['reports']]);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: client ? { ...client, billingFrequency: client.billingFrequency ?? 'MONTHLY', contractStartDate: isoDate(client.contractStartDate) } : { currency: 'USD', service: 'META_ADS', status: 'ACTIVE', billingFrequency: 'MONTHLY', contractStartDate: isoDate(), monthlyFee: 0 } });
  return (
    <Modal title={client ? 'Edit Client' : 'New Client'} onClose={onClose}>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(async (body) => { await save.mutateAsync({ id: client?.id, body }); onClose(); })}>
        <Field label="Name" error={errors.name?.message}><input className="input" {...register('name')} /></Field>
        <Field label="Company"><input className="input" {...register('company')} /></Field>
        <Field label="Phone"><input className="input" {...register('phone')} /></Field>
        <Field label="Email"><input className="input" {...register('email')} /></Field>
        <Field label="Service"><select className="input" {...register('service')}>{services.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select></Field>
        <Field label="Status"><select className="input" {...register('status')}>{statuses.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select></Field>
        <Field label="Fee"><input className="input" type="number" step="0.01" {...register('monthlyFee')} /></Field>
        <Field label="Billing Type"><select className="input" {...register('billingFrequency')}>{frequencies.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select></Field>
        <Field label="Currency"><input className="input" {...register('currency')} /></Field>
        <Field label="Contract Start"><input className="input" type="date" {...register('contractStartDate')} /></Field>
        <Field label="Notes"><textarea className="input min-h-24" {...register('notes')} /></Field>
        <button className="btn-primary md:col-span-2" disabled={save.isPending}>Save</button>
      </form>
    </Modal>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label><span className="label mb-1 block">{label}</span>{children}{error && <span className="mt-1 block text-xs text-red-400">{error}</span>}</label>;
}
