'use client';

import React from 'react';
import styles from './UserList.module.css';

export default function UserList({ users = [], hostId, currentUserId, onMakeHost }) {
  
  const getAvatarLetter = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  // Generate a consistent color based on name string
  const getAvatarColor = (name) => {
    if (!name) return 'var(--accent)';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 60%)`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Participants ({users.length})</h3>
      </div>
      
      <ul className={styles.list}>
        {users.map(user => {
          const isHost = user.id === hostId;
          const isMe = user.id === currentUserId;
          
          return (
            <li key={user.id} className={styles.userRow}>
              <div 
                className={styles.avatar} 
                style={{ backgroundColor: getAvatarColor(user.name) }}
              >
                {getAvatarLetter(user.name)}
                <div className={styles.onlineDot} />
              </div>
              
              <div className={styles.userInfo}>
                <span className={styles.userName}>
                  {user.name}
                  {isMe && <span className={styles.isMe}> (You)</span>}
                </span>
                
                {isHost ? (
                  <span className={styles.hostBadge}>Host</span>
                ) : (
                  hostId === currentUserId && !isMe && (
                    <button 
                      className={styles.makeHostBtn} 
                      onClick={() => onMakeHost(user.id)}
                      title={`Make ${user.name} the Host`}
                    >
                      Make Host
                    </button>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
