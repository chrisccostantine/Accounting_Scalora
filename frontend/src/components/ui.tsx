import type { ReactNode } from 'react';

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      {action}
    </div>
  );
}

export function EmptyState({ title }: { title: string }) {
  return <div className="panel py-12 text-center text-sm text-slate-400">{title}</div>;
}

export function Skeleton() {
  return <div className="panel h-48 animate-pulse bg-slate-900" />;
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="panel max-h-[90vh] w-full max-w-3xl overflow-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
