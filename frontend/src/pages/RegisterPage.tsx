import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Field, inputCls } from './LoginPage';
import type { Role } from '../types';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('CUSTOMER');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(name, email, password, role);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-center text-2xl font-bold">Create account</h1>
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <Field label="Name">
          <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Email">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Password (min 8 chars)">
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </Field>
        <Field label="I am a">
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputCls}>
            <option value="CUSTOMER">Customer</option>
            <option value="ORG">Organiser</option>
            <option value="ADMIN">Admin</option>
          </select>
        </Field>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={busy} className="w-full rounded-md bg-indigo-600 py-2 font-semibold hover:bg-indigo-500 disabled:opacity-50">
          {busy ? 'Creating…' : 'Register'}
        </button>
        <p className="text-center text-sm text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="text-indigo-400 hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}