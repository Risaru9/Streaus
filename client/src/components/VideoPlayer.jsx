'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './VideoPlayer.module.css';
import { BACKEND_URL } from '@/lib/socket';

export default function VideoPlayer({ socket, roomId, isHost, initialPlaybackState }) {
  // Video player states
  const [videoUrl, setVideoUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [fileName, setFileName] = useState('');
  const [buffered, setBuffered] = useState(0);
  const [subtitleUrl, setSubtitleUrl] = useState('');
  
  // Uploading state
  const [isUploading, setIsUploading] = useState(false);
  
  // UI states for Toast and Modal
  const [toastMessage, setToastMessage] = useState(null);
  const [confirmRequest, setConfirmRequest] = useState(null);

  // Helper for showing a temporary toast notification
  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Refs for tracking elements and sync timing
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const initialSyncStateRef = useRef(null);

  // Format seconds into HH:MM:SS format
  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds) || timeInSeconds === Infinity) return '00:00:00';
    const h = Math.floor(timeInSeconds / 3600);
    const m = Math.floor((timeInSeconds % 3600) / 60);
    const s = Math.floor(timeInSeconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Get a clean display name for the file (removes timestamp prefix and path details)
  const getDisplayFileName = (name) => {
    if (!name) return '';
    const base = name.substring(name.lastIndexOf('/') + 1);
    return base.replace(/^\d+-/, ''); // Strip multer timestamp if present
  };

  // Sync state whenever initialPlaybackState prop updates (like when room is joined)
  useEffect(() => {
    if (!initialPlaybackState) return;
    
    const { videoName, videoDuration, isPlaying: shouldPlay, currentTime: targetTime, isUrl, videoUrl: serverVideoUrl } = initialPlaybackState;
    if (videoName) {
      setFileName(videoName);
      setDuration(videoDuration);

      if (isUrl) {
        // If it has a custom videoUrl from backend, load it, otherwise load the videoName (which might be the full URL)
        setVideoUrl(serverVideoUrl || videoName);
      }

      // Buffer the sync state to apply once metadata loads
      initialSyncStateRef.current = { isPlaying: shouldPlay, currentTime: targetTime };
    }
  }, [initialPlaybackState]);

  // Upload file to server and trigger playback/request
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('video', file);

    try {
      const response = await fetch(`${BACKEND_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'No detailed error message');
        throw new Error(`Server returned status ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const absoluteUrl = `${BACKEND_URL}${data.url}`;

      if (isHost) {
        // Host changes the video immediately
        setVideoUrl(absoluteUrl);
        setFileName(data.originalName);
        if (socket) {
          socket.emit('player:video-loaded', {
            videoName: data.originalName,
            videoDuration: 0,
            isUrl: true,
            videoUrl: absoluteUrl
          });
        }
      } else {
        // Guest sends change request to Host
        if (socket) {
          socket.emit('player:request-change', {
            fileName: data.originalName,
            url: absoluteUrl
          });
        }
        showToast('Upload successful! Change request sent to Host.');
      }
    } catch (err) {
      console.error(err);
      showToast(`Failed to upload video: ${err.message}`);
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset file input
    }
  };

  // Submit URL directly (Host loads instantly, Guest requests approval)
  const handleUrlSubmit = (e) => {
    e.preventDefault();
    const url = e.target.elements.url.value;
    if (url) {
      if (isHost) {
        setVideoUrl(url);
        setFileName(url);
        if (socket) {
          socket.emit('player:video-loaded', { 
            videoName: url, 
            videoDuration: 0, 
            isUrl: true 
          });
        }
      } else {
        if (socket) {
          socket.emit('player:request-change', {
            fileName: url,
            url: url
          });
        }
        showToast('Change request sent to Host. Waiting for approval...');
      }
      e.target.reset();
    }
  };

  const convertSrtToVtt = (srtContent) => {
    let vtt = 'WEBVTT\n\n';
    vtt += srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    return vtt;
  };

  const handleSubtitleChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      if (file.name.endsWith('.srt')) {
        const text = await file.text();
        const vttText = convertSrtToVtt(text);
        const blob = new Blob([vttText], { type: 'text/vtt' });
        setSubtitleUrl(URL.createObjectURL(blob));
      } else {
        setSubtitleUrl(URL.createObjectURL(file));
      }
      showToast('Subtitle loaded successfully!');
    } catch (err) {
      console.error(err);
      showToast('Failed to load subtitle.');
    }
    e.target.value = '';
  };

  // Play/Pause handler triggered by local user interaction
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        socket?.emit('player:pause', { currentTime: videoRef.current.currentTime });
      } else {
        videoRef.current.play().catch(e => console.error("Error playing video:", e));
        socket?.emit('player:play', { currentTime: videoRef.current.currentTime });
      }
    }
  };

  // Seek handler triggered by local user interaction
  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      socket?.emit('player:seek', { currentTime: newTime });
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (!newMuted && volume === 0) {
        setVolume(1);
        videoRef.current.volume = 1;
      }
    }
  };

  // Fullscreen support
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error("Error entering fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Handle auto-hiding controls overlay
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  // Sync fullscreen state based on document event
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcut: Spacebar to Play/Pause
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaying, togglePlay]); // togglePlay changes on re-renders, but since it depends on refs mostly it's fine.

  // Touch handlers for double-tap to seek
  const lastTapRef = useRef({ time: 0, x: 0 });

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1 || !videoRef.current) return; 
    const touch = e.touches[0];
    const now = Date.now();
    const lastTap = lastTapRef.current;
    
    if (now - lastTap.time < 300) {
      const screenWidth = window.innerWidth;
      const tapX = touch.clientX;
      
      let newTime = currentTime;
      if (tapX > screenWidth / 2) {
        newTime = Math.min(duration, currentTime + 10);
        showToast('⏩ +10s');
      } else {
        newTime = Math.max(0, currentTime - 10);
        showToast('⏪ -10s');
      }
      
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      socket?.emit('player:seek', { currentTime: newTime });
      
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x: touch.clientX };
    }
  };

  // Setup video element event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onWaiting = () => socket?.emit('player:buffering', { isBuffering: true });
    const onPlaying = () => socket?.emit('player:buffering', { isBuffering: false });
    const onEnded = () => {
      if (isHost && socket) {
        socket.emit('queue:next');
      }
    };

    // Apply sync state once metadata loads
    const onMetadataLoaded = () => {
      if (initialSyncStateRef.current) {
        const { isPlaying: shouldPlay, currentTime: targetTime } = initialSyncStateRef.current;
        video.currentTime = targetTime;
        if (shouldPlay) {
          video.play().catch(e => console.error("Initial auto-play prevented:", e));
        }
        initialSyncStateRef.current = null;
      }
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('progress', onProgress);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('ended', onEnded);
    video.addEventListener('loadedmetadata', onMetadataLoaded);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('loadedmetadata', onMetadataLoaded);
    };
  }, [videoUrl, socket]);

  // Host auto-sync heartbeat
  useEffect(() => {
    if (!isHost || !isPlaying || !socket) return;
    
    const interval = setInterval(() => {
      if (videoRef.current) {
        socket.emit('player:heartbeat', { currentTime: videoRef.current.currentTime });
      }
    }, 4000); // Check every 4 seconds
    
    return () => clearInterval(interval);
  }, [isHost, isPlaying, socket]);

  // Setup socket sync events
  useEffect(() => {
    if (!socket) return;

    // Listen to remote playback actions
    const onRemotePlay = ({ currentTime }) => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentTime;
        videoRef.current.play().catch(e => console.error("Autoplay prevented:", e));
      }
    };

    const onRemotePause = ({ currentTime }) => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentTime;
        videoRef.current.pause();
      }
    };

    const onRemoteSeek = ({ currentTime }) => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentTime;
      }
    };

    // Listen to remote video loading actions (HLS, DASH, or server URL stream)
    const onVideoInfo = ({ videoName, videoDuration, isUrl, videoUrl: serverVideoUrl }) => {
      setFileName(videoName);
      setDuration(videoDuration);
      
      // Load the direct video URL stream
      const loadUrl = serverVideoUrl || videoName;
      setVideoUrl(loadUrl);
    };

    const onRemoteHeartbeat = ({ currentTime }) => {
      if (isHost || !videoRef.current) return;
      // Allow up to 2 seconds drift
      if (Math.abs(videoRef.current.currentTime - currentTime) > 2.5) {
        videoRef.current.currentTime = currentTime;
        showToast('Auto-syncing to host...');
      }
    };

    // Guest change request prompt (Host only)
    const onRequestChange = ({ requesterName, requesterSocketId, fileName: reqFileName, url: reqUrl }) => {
      // Pause playback while reviewing request if host wants to
      setConfirmRequest({
        requesterName,
        requesterSocketId,
        fileName: reqFileName,
        url: reqUrl
      });
    };

    const onChangeRejected = ({ rejectedBy }) => {
      showToast(`Host ${rejectedBy} rejected your video change request.`);
    };

    socket.on('player:play', onRemotePlay);
    socket.on('player:pause', onRemotePause);
    socket.on('player:seek', onRemoteSeek);
    socket.on('player:video-info', onVideoInfo);
    socket.on('player:heartbeat', onRemoteHeartbeat);
    socket.on('player:request-change', onRequestChange);
    socket.on('player:change-rejected', onChangeRejected);

    return () => {
      socket.off('player:play', onRemotePlay);
      socket.off('player:pause', onRemotePause);
      socket.off('player:seek', onRemoteSeek);
      socket.off('player:video-info', onVideoInfo);
      socket.off('player:heartbeat', onRemoteHeartbeat);
      socket.off('player:request-change', onRequestChange);
      socket.off('player:change-rejected', onChangeRejected);
    };
  }, [socket]);

  const handleConfirmResponse = (approved) => {
    if (!confirmRequest || !socket) return;
    socket.emit('player:respond-change', {
      approved,
      requesterSocketId: confirmRequest.requesterSocketId,
      fileName: confirmRequest.fileName,
      url: confirmRequest.url
    });
    setConfirmRequest(null);
  };

  return (
    <div 
      className={styles.container} 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Toast Notification Overlay */}
      {toastMessage && (
        <div className={styles.toastContainer}>
          {toastMessage}
        </div>
      )}

      {/* Custom Confirm Modal Overlay */}
      {confirmRequest && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <p>
              Guest <strong>"{confirmRequest.requesterName}"</strong> wants to change the video to:
              <strong>{confirmRequest.fileName}</strong>
              Approve this change?
            </p>
            <div className={styles.modalButtons}>
              <button className={`${styles.modalButton} ${styles.reject}`} onClick={() => handleConfirmResponse(false)}>Reject</button>
              <button className={`${styles.modalButton} ${styles.accept}`} onClick={() => handleConfirmResponse(true)}>Approve</button>
            </div>
          </div>
        </div>
      )}

      {isUploading ? (
        <div className={styles.placeholder}>
          <div className={styles.spinner} />
          <h2>Uploading video to server...</h2>
          <p>Please wait while the file is processed.</p>
        </div>
      ) : !videoUrl ? (
        <div className={styles.placeholder}>
          <div className={styles.setupControls}>
            <h2>No video loaded</h2>
            <>
              <label className={styles.fileButton}>
                Choose & Upload Local File
                <input type="file" accept="video/*" onChange={handleFileChange} hidden />
              </label>
              <form onSubmit={handleUrlSubmit} className={styles.urlForm}>
                <input type="url" name="url" placeholder="Or enter direct video URL..." required />
                <button type="submit">Load URL</button>
              </form>
            </>
          </div>
        </div>
      ) : (
        <>
          <video 
            ref={videoRef} 
            src={videoUrl} 
            className={styles.video}
            onClick={togglePlay}
            onTouchStart={handleTouchStart}
          >
            {subtitleUrl && (
              <track kind="subtitles" src={subtitleUrl} srcLang="en" label="Local Subtitle" default />
            )}
          </video>

          <div className={`${styles.controlsOverlay} ${!showControls ? styles.hidden : ''}`}>
            <div className={styles.topBar}>
              <span className={styles.fileName}>{getDisplayFileName(fileName)}</span>
            </div>
            
            <div className={styles.bottomBar}>
              <div className={styles.progressContainer}>
                <div 
                  className={styles.bufferedBar} 
                  style={{ width: `${(buffered / (duration || 1)) * 100}%` }} 
                />
                <input 
                  type="range" 
                  min={0} 
                  max={duration || 100} 
                  value={currentTime} 
                  onChange={handleSeek} 
                  className={styles.progressBar}
                />
              </div>
              
              <div className={styles.controlsRow}>
                <div className={styles.leftControls}>
                  <button onClick={togglePlay} className={styles.iconButton} aria-label={isPlaying ? "Pause" : "Play"}>
                    {isPlaying ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>
                    )}
                  </button>
                  
                  <div className={styles.volumeControl}>
                    <button onClick={toggleMute} className={styles.iconButton} aria-label={isMuted ? "Unmute" : "Mute"}>
                      {isMuted || volume === 0 ? (
                        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                      )}
                    </button>
                    <input 
                      type="range" 
                      min={0} 
                      max={1} 
                      step={0.05} 
                      value={isMuted ? 0 : volume} 
                      onChange={handleVolumeChange} 
                      className={styles.volumeSlider}
                    />
                  </div>
                  
                  <span className={styles.timeDisplay}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                
                <div className={styles.rightControls}>
                  <label className={styles.changeFileButton}>
                    Load Subtitle
                    <input type="file" accept=".srt,.vtt" onChange={handleSubtitleChange} hidden />
                  </label>
                  <label className={styles.changeFileButton}>
                    Change Video File
                    <input type="file" accept="video/*" onChange={handleFileChange} hidden />
                  </label>
                  <button onClick={toggleFullscreen} className={styles.iconButton} aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                    {isFullscreen ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
