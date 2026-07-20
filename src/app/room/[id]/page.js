'use client';

import { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './room.module.css';
import VideoPlayer from '@/components/VideoPlayer';
import ChatPanel from '@/components/ChatPanel';
import UserList from '@/components/UserList';
import QueuePanel from '@/components/QueuePanel';

export default function RoomPage({ params }) {
  const router = useRouter();
  const { id: roomId } = use(params);
  
  const [activeTab, setActiveTab] = useState('chat');
  const [userName, setUserName] = useState('');
  const [channel, setChannel] = useState(null);
  const [users, setUsers] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [queue, setQueue] = useState([]);
  const [hostId, setHostId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Keep latest state in a ref to avoid resetting the realtime subscription when state updates
  const stateRef = useRef({ chatHistory, queue, hostId, userName });
  useEffect(() => {
    stateRef.current = { chatHistory, queue, hostId, userName };
  }, [chatHistory, queue, hostId, userName]);

  useEffect(() => {
    let name = sessionStorage.getItem('userName');
    if (!name) {
      name = new URLSearchParams(window.location.search).get('name');
    }
    if (!name) {
      router.push('/');
      return;
    }
    setUserName(name);

    const roomChannel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: { key: name },
        broadcast: { self: true, ack: false }
      }
    });

    roomChannel
      .on('presence', { event: 'sync' }, () => {
        const state = roomChannel.presenceState();
        const activeUsers = [];
        let firstUser = null;
        let oldestTime = Infinity;

        Object.keys(state).forEach((key) => {
          const userArr = state[key];
          if (userArr.length > 0) {
            const u = userArr[0];
            activeUsers.push(u);
            if (u.joinedAt < oldestTime) {
              oldestTime = u.joinedAt;
              firstUser = u.userName;
            }
          }
        });
        setUsers(activeUsers);
        if (firstUser) {
          setHostId(firstUser);
        }
      })
      .on('broadcast', { event: 'chat:message' }, (payload) => {
        setChatHistory((prev) => [...prev, payload.payload]);
      })
      .on('broadcast', { event: 'queue:update' }, (payload) => {
        setQueue(payload.payload.queue);
      })
      .on('broadcast', { event: 'state:request' }, (payload) => {
        // Only the host responds to state sync requests to prevent conflicting states
        const { chatHistory: latestChat, queue: latestQueue, hostId: latestHost, userName: latestUser } = stateRef.current;
        if (latestHost === latestUser) {
          roomChannel.send({
            type: 'broadcast',
            event: 'state:sync',
            payload: {
              targetUser: payload.payload.from,
              chatHistory: latestChat,
              queue: latestQueue
            }
          });
        }
      })
      .on('broadcast', { event: 'state:sync' }, (payload) => {
        if (payload.payload.targetUser === name) {
          setChatHistory(payload.payload.chatHistory || []);
          setQueue(payload.payload.queue || []);
        }
      });

    roomChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        // Track presence: pass both name (for UserList) and userName (for Host tracking)
        await roomChannel.track({ 
          userName: name, 
          name: name,
          id: name, 
          joinedAt: Date.now() 
        });
        
        // Request current room state from the host
        roomChannel.send({
          type: 'broadcast',
          event: 'state:request',
          payload: { from: name }
        });
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setIsConnected(false);
      }
    });

    setChannel(roomChannel);

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [roomId, router]);

  const copyRoomCode = () => navigator.clipboard.writeText(roomId);
  const handleLeaveRoom = () => router.push('/');

  if (!userName || !channel) return null;
  const isHost = hostId === userName;

  return (
    <div className={styles.roomLayout}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h2>Watch Party <span className={styles.roomCode}>{roomId}</span></h2>
          <button className="btn btn-secondary" onClick={copyRoomCode}>Copy</button>
        </div>
        <div className={styles.headerRight}>
          <span className={`${styles.status} ${isConnected ? styles.connected : styles.disconnected}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          <button className="btn btn-secondary" onClick={handleLeaveRoom}>Leave Room</button>
        </div>
      </header>

      <main className={styles.mainContent}>
        <div className={styles.videoSection}>
          <VideoPlayer channel={channel} roomId={roomId} isHost={isHost} />
        </div>
        <aside className={styles.sidebar}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${activeTab === 'chat' ? styles.activeTab : ''}`} onClick={() => setActiveTab('chat')}>Chat</button>
            <button className={`${styles.tab} ${activeTab === 'users' ? styles.activeTab : ''}`} onClick={() => setActiveTab('users')}>Users</button>
            <button className={`${styles.tab} ${activeTab === 'queue' ? styles.activeTab : ''}`} onClick={() => setActiveTab('queue')}>Queue</button>
          </div>
          <div className={styles.tabContent}>
            {activeTab === 'chat' && <ChatPanel channel={channel} userName={userName} chatHistory={chatHistory} />}
            {activeTab === 'users' && <UserList users={users} hostId={hostId} currentUserId={userName} />}
            {activeTab === 'queue' && <QueuePanel channel={channel} queue={queue} isHost={isHost} setQueue={setQueue} />}
          </div>
        </aside>
      </main>
    </div>
  );
}
