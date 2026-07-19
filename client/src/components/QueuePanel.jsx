'use client';

import React, { useState } from 'react';
import styles from './QueuePanel.module.css';

export default function QueuePanel({ socket, roomId, queue = [], isHost }) {
  const [urlInput, setUrlInput] = useState('');

  const handleAddUrl = (e) => {
    e.preventDefault();
    if (urlInput.trim() && socket) {
      socket.emit('queue:add', { fileName: urlInput.trim(), url: urlInput.trim() });
      setUrlInput('');
    }
  };

  const handleRemove = (index) => {
    if (socket && isHost) {
      socket.emit('queue:remove', { index });
    }
  };

  const handlePlayNext = () => {
    if (socket && isHost) {
      socket.emit('queue:next');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Up Next ({queue.length})</h3>
        {isHost && queue.length > 0 && (
          <button className={styles.playNextBtn} onClick={handlePlayNext}>Play Next</button>
        )}
      </div>

      <div className={styles.addForm}>
        <form onSubmit={handleAddUrl} className={styles.form}>
          <input 
            type="url" 
            placeholder="Add video URL to queue..." 
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className={styles.input}
            required
          />
          <button type="submit" className={styles.addBtn}>Add</button>
        </form>
      </div>

      <ul className={styles.list}>
        {queue.length === 0 ? (
          <li className={styles.emptyState}>Queue is empty.</li>
        ) : (
          queue.map((item, index) => (
            <li key={item.id} className={styles.queueItem}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{item.fileName.substring(item.fileName.lastIndexOf('/') + 1)}</span>
                <span className={styles.itemAddedBy}>Added by {item.addedBy}</span>
              </div>
              {isHost && (
                <button 
                  className={styles.removeBtn} 
                  onClick={() => handleRemove(index)}
                  title="Remove from queue"
                >
                  ✕
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
