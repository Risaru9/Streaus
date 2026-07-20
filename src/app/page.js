'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

export default function LandingPage() {
  const router = useRouter();
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setUser(session.user);
        // Automatically use email name as default display name
        const defaultName = session.user.email.split('@')[0];
        setCreateName(defaultName);
        setJoinName(defaultName);
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('API logout failed, falling back:', err);
    }
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleCreate = () => {
    if (!createName) return;
    sessionStorage.setItem('userName', createName);
    // Generating a random 6-character room ID
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push(`/room/${newRoomId}`);
  };

  const handleJoin = () => {
    if (!joinCode || !joinName) return;
    sessionStorage.setItem('userName', joinName);
    router.push(`/room/${joinCode}?name=${encodeURIComponent(joinName)}`);
  };

  if (loading) return <div className={styles.container} style={{justifyContent: 'center'}}>Loading...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.hero}>
        <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{color: 'var(--text-secondary)'}}>{user?.email}</span>
          <button className="btn btn-secondary" style={{padding: '0.25rem 0.75rem'}} onClick={handleLogout}>Logout</button>
        </div>
        <h1 className={styles.title}>WatchParty</h1>
        <p className={styles.subtitle}>Watch videos together with your friends in real-time.</p>
      </header>
      
      <main className={styles.cardsContainer}>
        <div className={`card ${styles.card}`}>
          <h2>Create Room</h2>
          <div className="input-group">
            <label>Display Name</label>
            <input 
              className="input" 
              placeholder="Your name" 
              value={createName} 
              onChange={(e) => setCreateName(e.target.value)} 
            />
          </div>
          <button className="btn btn-primary" onClick={handleCreate}>Create Room</button>
        </div>

        <div className={`card ${styles.card}`}>
          <h2>Join Room</h2>
          <div className="input-group">
            <label>Room Code</label>
            <input 
              className="input" 
              placeholder="e.g. xyz-123" 
              value={joinCode} 
              onChange={(e) => setJoinCode(e.target.value)} 
            />
          </div>
          <div className="input-group">
            <label>Display Name</label>
            <input 
              className="input" 
              placeholder="Your name" 
              value={joinName} 
              onChange={(e) => setJoinName(e.target.value)} 
            />
          </div>
          <button className="btn btn-secondary" onClick={handleJoin}>Join Room</button>
        </div>
      </main>
    </div>
  );
}
