'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
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
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [playbackState, setPlaybackState] = useState(null);
  const [hostId, setHostId] = useState(null);
  const [socketId, setSocketId] = useState(null);
  const [socket, setSocket] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [kickedReason, setKickedReason] = useState(null);
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    let name = sessionStorage.getItem('userName');
    if (!name) {
      const urlParams = new URLSearchParams(window.location.search);
      name = urlParams.get('name');
    }
    
    if (!name) {
      router.push('/');
      return;
    }
    
    setUserName(name);

    const s = getSocket();
    setSocket(s);
    
    const handleJoin = () => {
      setIsConnected(true);
      setSocketId(s.id);
      s.emit('room:join', { roomId, userName: name }, (response) => {
        if (response && response.room) {
          setUsers(response.room.users || []);
          setChatHistory(response.room.chatHistory || []);
          setPlaybackState(response.room.playbackState || null);
          setHostId(response.room.host);
          setQueue(response.room.queue || []);
        }
      });
    };

    if (s.connected) {
      handleJoin();
    } else {
      s.connect();
    }
    
    s.on('connect', handleJoin);

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    s.on('room:user-joined', (data) => {
      if (data.users) setUsers(data.users);
    });
    
    s.on('room:user-left', (data) => {
      if (data.users) setUsers(data.users);
      if (data.newHost) setHostId(data.newHost);
    });

    s.on('chat:message', (msg) => {
      setChatHistory((prev) => [...prev, msg]);
    });

    s.on('room:deleted', (data) => {
      setKickedReason(data.reason || 'Room was deleted.');
      s.disconnect();
    });

    s.on('queue:updated', (newQueue) => {
      setQueue(newQueue);
    });

    return () => {
      s.off('connect');
      s.off('disconnect');
      s.off('room:user-joined');
      s.off('room:user-left');
      s.off('chat:message');
      s.off('room:deleted');
      s.off('queue:updated');
    };
  }, [roomId, router]);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
  };

  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit('room:leave');
      socket.disconnect();
    }
    router.push('/');
  };

  const handleMakeHost = (targetUserId) => {
    if (socket) {
      socket.emit('room:transfer-host', { targetUserId });
    }
  };

  const handleDeleteRoom = () => {
    if (socket) {
      socket.emit('room:delete', {}, () => {
        socket.disconnect();
        router.push('/');
      });
    } else {
      router.push('/');
    }
  };

  if (!userName) return null;

  if (kickedReason) {
    return (
      <div className={styles.modalOverlay} style={{ zIndex: 9999 }}>
        <div className={styles.modalContent}>
          <h3 style={{ color: 'var(--error)' }}>Room Closed</h3>
          <p style={{ margin: '1.5rem 0', color: 'var(--text-secondary)' }}>{kickedReason}</p>
          <button className="btn btn-primary" onClick={() => router.push('/')}>Return to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.roomLayout}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h2>Watch Party <span className={styles.roomCode}>{roomId}</span></h2>
          <button className="btn btn-secondary" onClick={copyRoomCode}>Copy</button>
        </div>
        <div className={styles.headerRight}>
          <span className={`${styles.status} ${socket ? styles.connected : styles.disconnected}`}>
            {socket ? 'Connected' : 'Disconnected'}
          </span>
          
          {hostId === socketId ? (
            <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}>Delete Room</button>
          ) : (
            <button className="btn btn-secondary" onClick={handleLeaveRoom}>Leave Room</button>
          )}
        </div>
      </header>

      {showDeleteConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>Delete Room?</h3>
            <p style={{ margin: '1rem 0', color: 'var(--text-secondary)' }}>
              This will immediately close the room and kick all users out. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteRoom}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      <main className={styles.mainContent}>
        <div className={styles.videoSection}>
          <VideoPlayer 
            socket={socket} 
            roomId={roomId} 
            isHost={hostId === socketId} 
            initialPlaybackState={playbackState}
          />
        </div>

        <aside className={styles.sidebar}>
          <div className={styles.tabs}>
            <button 
              className={`${styles.tab} ${activeTab === 'chat' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              Chat
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'users' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('users')}
            >
              Users
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'queue' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('queue')}
            >
              Queue
            </button>
          </div>
          
          <div className={styles.tabContent}>
            {activeTab === 'chat' && (
              <ChatPanel 
                socket={socket} 
                roomId={roomId} 
                userName={userName} 
                chatHistory={chatHistory} 
              />
            )}
            {activeTab === 'users' && (
              <UserList 
                users={users} 
                hostId={hostId} 
                currentUserId={socketId} 
                onMakeHost={handleMakeHost}
              />
            )}
            {activeTab === 'queue' && (
              <QueuePanel 
                socket={socket} 
                roomId={roomId} 
                queue={queue} 
                isHost={hostId === socketId} 
              />
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
