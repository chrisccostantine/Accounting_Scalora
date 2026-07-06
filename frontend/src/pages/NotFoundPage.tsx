import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-black p-4 text-center">
      <div>
        <h1 className="text-5xl font-bold">404</h1>
        <p className="mt-3 text-slate-400">Page not found.</p>
        <Link className="btn-primary mt-6" to="/">Back to dashboard</Link>
      </div>
    </div>
  );
}
