import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { EmptyState, Modal, PageHeader, Skeleton } from '../components/ui';
import { useApiQuery, useDelete, useSave } from '../hooks/useApi';
import type { Attachment, AttachmentEntityType, Paginated } from '../types';
import { isoDate, labelize } from '../utils/format';

const entityTypes: AttachmentEntityType[] = ['CLIENT', 'INCOME', 'EXPENSE', 'INVOICE', 'ADVANCE'];
const schema = z.object({ entityType: z.enum(entityTypes as [AttachmentEntityType, ...AttachmentEntityType[]]), entityId: z.string().min(1), title: z.string().min(1), url: z.string().url(), notes: z.string().optional() });
type FormValues = z.infer<typeof schema>;

export function AttachmentsPage() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useApiQuery<Paginated<Attachment>>(['attachments'], '/attachments?limit=50');
  const remove = useDelete('/attachments', ['attachments']);
  return (
    <>
      <PageHeader title="Attachments" action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Add Link</button>} />
      {isLoading ? <Skeleton /> : !data?.items.length ? <EmptyState title="No attachments yet." /> : (
        <div className="panel overflow-x-auto"><table className="w-full min-w-[860px]"><thead><tr><th className="table-th">Title</th><th className="table-th">Record Type</th><th className="table-th">Record ID</th><th className="table-th">Added</th><th className="table-th"></th></tr></thead><tbody>{data.items.map((item) => <tr key={item.id}><td className="table-td"><a className="font-semibold text-white hover:text-scalora-blue" href={item.url} target="_blank" rel="noreferrer">{item.title} <ExternalLink className="inline" size={13} /></a><p className="text-xs text-slate-500">{item.notes}</p></td><td className="table-td">{labelize(item.entityType)}</td><td className="table-td">{item.entityId}</td><td className="table-td">{isoDate(item.createdAt)}</td><td className="table-td text-right"><button className="btn-secondary" onClick={() => confirm('Delete this attachment?') && remove.mutate(item.id)}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div>
      )}
      {open && <AttachmentModal onClose={() => setOpen(false)} />}
    </>
  );
}

function AttachmentModal({ onClose }: { onClose: () => void }) {
  const save = useSave<FormValues>('/attachments', ['attachments']);
  const { register, handleSubmit } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { entityType: 'INVOICE' } });
  return <Modal title="Add Attachment Link" onClose={onClose}><form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(async (body) => { await save.mutateAsync({ body }); onClose(); })}><Field label="Record Type"><select className="input" {...register('entityType')}>{entityTypes.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select></Field><Field label="Record ID"><input className="input" {...register('entityId')} /></Field><Field label="Title"><input className="input" {...register('title')} /></Field><Field label="URL"><input className="input" {...register('url')} /></Field><Field label="Notes"><textarea className="input min-h-24" {...register('notes')} /></Field><button className="btn-primary md:col-span-2" disabled={save.isPending}>Save</button></form></Modal>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label><span className="label mb-1 block">{label}</span>{children}</label>;
}
