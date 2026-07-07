import { PageHeader, Skeleton } from '../components/ui';
import { useApiQuery } from '../hooks/useApi';
import type { ActivityLog, Paginated } from '../types';
import { labelize } from '../utils/format';

export function ActivityPage() {
  const { data, isLoading } = useApiQuery<Paginated<ActivityLog>>(['activity'], '/activity?limit=50');
  return (
    <>
      <PageHeader title="Activity" />
      {isLoading ? <Skeleton /> : (
        <div className="panel divide-y divide-slate-800">
          {data?.items.map((item) => <div key={item.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold text-white">{item.title}</p><span className="rounded bg-slate-800 px-2 py-1 text-xs">{labelize(item.action)} {labelize(item.entityType)}</span></div><p className="mt-1 text-sm text-slate-500">{item.details || item.entityId || ''}</p><p className="mt-2 text-xs text-slate-600">{new Date(item.createdAt).toLocaleString()}</p></div>)}
          {!data?.items.length && <p className="p-5 text-sm text-slate-500">No activity yet.</p>}
        </div>
      )}
    </>
  );
}
