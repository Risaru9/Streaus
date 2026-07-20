'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './ChatPanel.module.css';

export default function ChatPanel({ channel, userName, chatHistory = [] }) {
  const [inputValue, setInputValue] = useState('');
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const messagesEndRef = useRef(null);

  const EMOJIS = ['❤️', '😂', '👍', '🔥', '😮', '👏', '😢', '🎉'];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  useEffect(() => {
    if (!channel) return;
    let isActive = true;
    channel.on('broadcast', { event: 'chat:reaction' }, (payload) => {
      if (!isActive) return;
      const { emoji } = payload.payload;
      const id = Date.now() + Math.random();
      setFloatingEmojis(prev => [...prev, { id, emoji }]);
      setTimeout(() => {
        if (!isActive) return;
        setFloatingEmojis(prev => prev.filter(e => e.id !== id));
      }, 2000);
    });
    return () => { isActive = false; };
  }, [channel]);

  const handleSend = (e) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !channel) return;

    channel.send({
      type: 'broadcast',
      event: 'chat:message',
      payload: { text: inputValue, userName, timestamp: Date.now(), id: Date.now() }
    });
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sendReaction = (emoji) => {
    if (channel) {
      channel.send({ type: 'broadcast', event: 'chat:reaction', payload: { emoji } });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}><h3>Chat</h3></div>
      <div className={styles.messageList}>
        {chatHistory.map((msg, index) => {
          const isMe = msg.userName === userName;
          return (
            <div key={msg.id || index} className={`${styles.messageWrapper} ${isMe ? styles.isMe : ''}`}>
              <div className={styles.messageContent}>
                {!isMe && <span className={styles.senderName}>{msg.userName}</span>}
                <div className={styles.bubble}>{msg.text}</div>
                <span className={styles.timestamp}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      {floatingEmojis.map((e) => (
        <div key={e.id} className={styles.floatingEmoji} style={{ left: `${Math.random() * 80 + 10}%` }}>
          {e.emoji}
        </div>
      ))}
      <div className={styles.inputArea}>
        <div className={styles.emojiBar}>
          {EMOJIS.map(emoji => (
            <button key={emoji} onClick={() => sendReaction(emoji)} className={styles.emojiButton}>{emoji}</button>
          ))}
        </div>
        <form onSubmit={handleSend} className={styles.form}>
          <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} placeholder="Type a message..." className={styles.input} />
          <button type="submit" className={styles.sendButton} disabled={!inputValue.trim()}>Send</button>
        </form>
      </div>
    </div>
  );
}
