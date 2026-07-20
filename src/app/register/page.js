'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Password requirement states
  const [reqs, setReqs] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    symbol: false,
  });

  useEffect(() => {
    setReqs({
      length: password.length >= 8 && password.length <= 12,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    });
  }, [password]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Frontend Validations
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Nama lengkap minimal 2 karakter (hanya huruf dan spasi).');
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setError('Format email tidak valid.');
      return;
    }

    const allReqsMet = Object.values(reqs).every(Boolean);
    if (!allReqsMet) {
      setError('Password harus memenuhi seluruh kriteria keamanan.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mendaftar.');
      }

      setSuccess('Pendaftaran sukses! Mengalihkan ke halaman login...');
      
      // Auto-redirect to login after 2.5 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2500);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={`card ${styles.card}`}>
        <h1 className={styles.title}>Daftar WatchParty</h1>
        <p className={styles.subtitle}>Buat akun baru untuk mulai menonton bersama</p>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <div className="input-group">
            <label htmlFor="fullName">Nama Lengkap</label>
            <input
              id="fullName"
              type="text"
              className="input"
              placeholder="Masukkan nama lengkap Anda"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading || success}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="contoh@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || success}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || success}
              required
            />
          </div>

          {/* Password strength checklist */}
          {password && (
            <div className={styles.passwordRequirements}>
              <div className={`${styles.requirement} ${reqs.length ? styles.valid : ''}`}>
                <span className={styles.requirementIcon}></span>
                <span>8 - 12 Karakter</span>
              </div>
              <div className={`${styles.requirement} ${reqs.uppercase ? styles.valid : ''}`}>
                <span className={styles.requirementIcon}></span>
                <span>Minimal 1 Huruf Besar</span>
              </div>
              <div className={`${styles.requirement} ${reqs.lowercase ? styles.valid : ''}`}>
                <span className={styles.requirementIcon}></span>
                <span>Minimal 1 Huruf Kecil</span>
              </div>
              <div className={`${styles.requirement} ${reqs.number ? styles.valid : ''}`}>
                <span className={styles.requirementIcon}></span>
                <span>Minimal 1 Angka</span>
              </div>
              <div className={`${styles.requirement} ${reqs.symbol ? styles.valid : ''}`}>
                <span className={styles.requirementIcon}></span>
                <span>Minimal 1 Simbol Khusus (e.g. @, $, !)</span>
              </div>
            </div>
          )}

          <div className="input-group">
            <label htmlFor="confirmPassword">Konfirmasi Password</label>
            <input
              id="confirmPassword"
              type="password"
              className="input"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading || success}
              required
            />
          </div>

          <div className={styles.buttonGroup}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || success}
            >
              {loading ? 'Sedang mendaftar...' : 'Daftar Sekarang'}
            </button>
          </div>
        </form>

        <div className={styles.footer}>
          Sudah punya akun?{' '}
          <Link href="/login" className={styles.link}>
            Masuk di sini
          </Link>
        </div>
      </div>
    </div>
  );
}
