'use client';

import React, { useState } from 'react';
import styles from './QueuePanel.module.css';

export default function QueuePanel({ channel, queue = [], isHost, setQueue }) {
  const [urlInput, setUrlInput] = useState('');

  const broadcastQueueUpdate = (newQueue) => {
    setQueue(newQueue);
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'queue:update',
        payload: { queue: newQueue }
      });
    }
  };

  const handleAddUrl = (e) => {
    e.preventDefault();
    if (urlInput.trim()) {
      const newItem = { id: Date.now(), fileName: urlInput.trim(), url: urlInput.trim() };
      broadcastQueueUpdate([...queue, newItem]);
      setUrlInput('');
    }
  };

  const handleRemove = (index) => {
    if (isHost) {
      const newQueue = [...queue];
      newQueue.splice(index, 1);
      broadcastQueueUpdate(newQueue);
    }
  };

  const handlePlayNext = () => {
    if (isHost && queue.length > 0) {
      const nextItem = queue[0];
      const newQueue = queue.slice(1);
      broadcastQueueUpdate(newQueue);
      
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'player:load',
          payload: { url: nextItem.url, isDirectLink: true }
        });
      }
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
          <input type="url" placeholder="Add video URL to queue..." value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className={styles.input} required />
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
              </div>
              {isHost && (
                <button className={styles.removeBtn} onClick={() => handleRemove(index)} title="Remove from queue">✕</button>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
