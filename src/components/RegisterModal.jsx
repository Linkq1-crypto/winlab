import { useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export default function RegisterModal({ onSuccess, onClose }) {
  const [mode, setMode] = useState('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const trimmedEmail = email.trim();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      setLoading(false);
      return;
    }

    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const body = mode === 'register'
      ? { email: trimmedEmail, password, name: name.trim() }
      : { email: trimmedEmail, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'An error occurred. Please try again.');
        setLoading(false);
        return;
      }
      setLoading(false);
      onSuccess(data.user, data.token ?? null);
    } catch {
      setError('Connection failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-[32px] border border-white/10 bg-zinc-900 p-5 shadow-2xl sm:p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="mb-2 pr-10 text-2xl font-black uppercase tracking-tighter text-white italic">
          {mode === 'register' ? 'Create Account' : 'Sign In'}
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          {mode === 'register'
            ? 'Register to save your progress.'
            : 'Welcome back, Operator.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/40 placeholder-gray-600"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/40 placeholder-gray-600"
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (min. 8 characters)"
              required
              minLength={8}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-3 pr-12 text-sm text-white outline-none focus:border-red-500/40 placeholder-gray-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-500 transition-colors hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error && (
            <p className="text-red-500 text-xs font-mono">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-red-600 text-white font-black uppercase tracking-widest italic rounded-2xl hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {loading ? 'Loading...' : mode === 'register' ? 'REGISTER' : 'SIGN IN'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); setShowPassword(false); }}
          className="mt-4 w-full text-center text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          {mode === 'register' ? 'Already have an account → Sign In' : 'No account → Register'}
        </button>
      </div>
    </div>
  );
}
