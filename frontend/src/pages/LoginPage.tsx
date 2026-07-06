import { zodResolver } from '@hookform/resolvers/zod';
import { LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import type { AxiosError } from 'axios';
import { useAuth } from '../context/AuthContext';

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
type LoginForm = z.infer<typeof schema>;

export function LoginPage() {
  const { login, token } = useAuth();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({ resolver: zodResolver(schema) });
  if (token) return <Navigate to="/" replace />;

  return (
    <div className="grid min-h-screen place-items-center bg-black p-4">
      <form className="panel w-full max-w-md p-6" onSubmit={handleSubmit(async (values) => {
        setError('');
        try {
          await login(values.email, values.password);
        } catch (caught) {
          const error = caught as AxiosError<{ message?: string }>;
          setError(error.response?.data?.message ?? 'Could not reach the backend. Check VITE_API_URL and backend CORS.');
        }
      })}>
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-md bg-scalora-blue p-3"><LockKeyhole size={22} /></div>
          <div>
            <h1 className="text-xl font-bold">Scalora Accounting</h1>
            <p className="text-sm text-slate-500">Admin access</p>
          </div>
        </div>
        <label className="label">Email</label>
        <input className="input mt-1" {...register('email')} />
        {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
        <label className="label mt-4 block">Password</label>
        <input className="input mt-1" type="password" {...register('password')} />
        {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
        {error && <p className="mt-4 rounded-md border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-200">{error}</p>}
        <button className="btn-primary mt-6 w-full" disabled={isSubmitting}>Login</button>
      </form>
    </div>
  );
}
