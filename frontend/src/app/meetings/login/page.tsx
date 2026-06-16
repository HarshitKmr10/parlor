'use client';

import React, { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ThemeToggle } from '../components/ThemeToggle';

export default function MeetingsLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get('next') || '/meetings';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/meetings/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || 'Login failed');
        setSubmitting(false);
        return;
      }
      // Cookie is now set; navigate to the requested destination.
      router.replace(next.startsWith('/meetings') ? next : '/meetings');
    } catch (err: any) {
      setError(err?.message || 'Network error');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-lg transition-colors dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Meeting Joiner</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Internal dashboard. Sign in to continue.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-200">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
            />
          </div>

          {Boolean(error) && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-blue-900"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
