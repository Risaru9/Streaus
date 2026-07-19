'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import styles from './page.module.css';

export default function LandingPage() {
  const router = useRouter();
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');

  const handleCreate = () => {
    if (!createName) return;
    sessionStorage.setItem('userName', createName);
    const socket = getSocket();
    socket.connect();
    socket.emit('room:create', { userName: createName }, (response) => {
      if (response && response.room && response.room.id) {
        router.push(`/room/${response.room.id}`);
      } else if (response && response.error) {
        console.error(response.error);
      }
    });
  };

  const handleJoin = () => {
    if (!joinCode || !joinName) return;
    sessionStorage.setItem('userName', joinName);
    router.push(`/room/${joinCode}?name=${encodeURIComponent(joinName)}`);
  };

  return (
    <div className={styles.container}>
      <header className={styles.hero}>
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
