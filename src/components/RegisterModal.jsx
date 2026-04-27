// src/components/RegisterModal.jsx
import { useState } from 'react';
import { X } from 'lucide-react';

export default function RegisterModal({ onSuccess, onClose }) {
  const [mode, setMode] = useState('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const body = mode === 'register'
      ? { email, password, name }
      : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Errore. Riprova.');
        return;
      }
      onSuccess(data.user);
    } catch {
      setError('Connessione fallita. Riprova.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-white/10 rounded-[32px] w-full max-w-md p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">
          {mode === 'register' ? 'Crea Account' : 'Accedi'}
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          {mode === 'register'
            ? 'Registrati per salvare il tuo progresso.'
            : 'Bentornato Operator.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Nome (opzionale)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/40 placeholder-gray-600"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/40 placeholder-gray-600"
          />
          <input
            type="password"
            placeholder="Password (min. 8 caratteri)"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/40 placeholder-gray-600"
          />

          {error && (
            <p className="text-red-500 text-xs font-mono">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-red-600 text-white font-black uppercase tracking-widest italic rounded-2xl hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {loading ? 'Caricamento...' : mode === 'register' ? 'REGISTRATI' : 'ACCEDI'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}
          className="mt-4 w-full text-center text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          {mode === 'register' ? 'Ho già un account → Accedi' : 'Nessun account → Registrati'}
        </button>
      </div>
    </div>
  );
}
