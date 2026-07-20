'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './VideoPlayer.module.css';
// Helper to automatically convert Google Drive & Dropbox links to direct streamable URLs
const getDirectStreamUrl = (url) => {
  if (!url) return '';
  const cleanUrl = url.trim();

  // 1. Google Drive Link Conversion
  const gdRegex1 = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
  const gdRegex2 = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
  
  const match1 = cleanUrl.match(gdRegex1);
  const match2 = cleanUrl.match(gdRegex2);
  const fileId = (match1 && match1[1]) || (match2 && match2[1]);
  
  if (fileId) {
    return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
  }

  // 2. Dropbox Link Conversion
  if (cleanUrl.includes('dropbox.com') && cleanUrl.endsWith('?dl=0')) {
    return cleanUrl.replace('?dl=0', '?raw=1');
  }

  // 3. Pixeldrain Link Conversion
  // Match both /u/ID and /api/file/ID, and strip ?download
  const pdRegex = /pixeldrain\.com\/(?:u|api\/file)\/([a-zA-Z0-9_-]+)/;
  const pdMatch = cleanUrl.match(pdRegex);
  if (pdMatch) {
    return `https://pixeldrain.com/api/file/${pdMatch[1]}`;
  }

  return cleanUrl;
};

export default function VideoPlayer({ roomId, isHost, userName, channel }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const isHostRef = useRef(isHost);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

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
  
  const [isUploading, setIsUploading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [confirmRequest, setConfirmRequest] = useState(null);

  const syncToDatabase = useCallback(async (payload) => {
    if (!isHostRef.current) return;
    const secret = localStorage.getItem(`streaus_host_secret_${roomId}`);
    if (!secret) return;
    try {
      await fetch('/api/room/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, hostSecret: secret, ...payload })
      });
    } catch (e) {
      console.error('Failed to sync to DB:', e);
    }
  }, [roomId]);


  const controlsTimeoutRef = useRef(null);
  const initialSyncStateRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds) || timeInSeconds === Infinity) return '00:00:00';
    const h = Math.floor(timeInSeconds / 3600);
    const m = Math.floor((timeInSeconds % 3600) / 60);
    const s = Math.floor(timeInSeconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getDisplayFileName = (name) => {
    if (!name) return '';
    const base = name.substring(name.lastIndexOf('/') + 1);
    return base.replace(/^\d+-/, '');
  };

  useEffect(() => {
    if (videoUrl) {
      console.log("[VideoPlayer] Loading video source URL:", videoUrl);
    }
  }, [videoUrl]);

  // Initial Fetch from Database
  useEffect(() => {
    let active = true;
    const fetchInitial = async () => {
      const { data, error } = await supabase.from('rooms').select('video_url, video_name, last_position, is_playing, updated_at').eq('id', roomId).single();
      if (!active) return;
      if (data && data.video_url) {
        setVideoUrl(data.video_url);
        setFileName(data.video_name || '');
        if (data.is_playing && data.last_position !== null) {
          const elapsed = (Date.now() - new Date(data.updated_at).getTime()) / 1000;
          const estTime = parseFloat(data.last_position) + elapsed;
          setCurrentTime(estTime);
          if (videoRef.current) {
            videoRef.current.currentTime = estTime;
            // Try to auto-play since Host is playing
            setTimeout(() => {
              videoRef.current?.play().catch(e => {
                console.error("Autoplay blocked on initial load:", e);
                showToast("Host is playing. Click Play to sync!");
              });
            }, 500);
          }
        } else if (data.last_position !== null) {
          setCurrentTime(parseFloat(data.last_position));
          if (videoRef.current) videoRef.current.currentTime = parseFloat(data.last_position);
        }
      }
    };
    fetchInitial();
    return () => { active = false; };
  }, [roomId]);

  // Claim Room / Generate Secret
  useEffect(() => {
    if (isHost) {
      let secret = localStorage.getItem(`streaus_host_secret_${roomId}`);
      if (!secret) {
        secret = crypto.randomUUID();
        fetch('/api/room/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, hostSecret: secret })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            localStorage.setItem(`streaus_host_secret_${roomId}`, secret);
          } else if (data.error === 'Room already exists') {
            console.log('Room is already claimed by someone else.');
          }
        })
        .catch(e => console.error(e));
      }
    }
  }, [isHost, roomId]);

  // Throttled Sync
  useEffect(() => {
    let interval;
    if (isHost && isPlaying) {
       interval = setInterval(() => {
          syncToDatabase({ isPlaying: true, lastPosition: videoRef.current?.currentTime || 0 });
       }, 10000);
    }
    return () => clearInterval(interval);
  }, [isHost, isPlaying, syncToDatabase]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // 1. Get presigned URL from our API
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type || 'video/mp4' })
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to get upload URL');
      }
      
      const { presignedUrl, publicUrl } = await res.json();

      // 2. Upload directly to Cloudflare R2 using the presigned URL
      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'video/mp4' },
        body: file
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload video to Cloudflare R2');
      }
      
      const absoluteUrl = publicUrl;

      if (isHost) {
        setVideoUrl(absoluteUrl);
        setFileName(file.name);
        if (channel) {
          channel.send({
            type: 'broadcast',
            event: 'player:video-loaded',
            payload: { videoName: file.name, videoDuration: 0, videoUrl: absoluteUrl }
          });
        }
        syncToDatabase({ videoUrl: absoluteUrl, videoName: file.name, isPlaying: false, lastPosition: 0 });
      } else {
        if (channel) {
          channel.send({
            type: 'broadcast',
            event: 'player:request-change',
            payload: { fileName: file.name, url: absoluteUrl, requesterSocketId: supabase.auth.user?.id || 'guest', requesterName: sessionStorage.getItem('userName') }
          });
        }
        showToast('Change request sent to Host.');
      }
    } catch (err) {
      console.error(err);
      showToast(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    const url = e.target.elements.url.value;
    const isManual = e.target.elements.manual?.checked;

    if (url) {
      const convertedUrl = isManual ? url : getDirectStreamUrl(url);
         
      if (isHost) {
        setVideoUrl(convertedUrl);
        setFileName(url);
        if (channel) {
          channel.send({ type: 'broadcast', event: 'player:video-loaded', payload: { videoName: url, videoDuration: 0, videoUrl: convertedUrl } });
        }
        syncToDatabase({ videoUrl: convertedUrl, videoName: url, isPlaying: false, lastPosition: 0 });
      } else {
        if (channel) {
          channel.send({ type: 'broadcast', event: 'player:request-change', payload: { fileName: url, url: convertedUrl, requesterName: sessionStorage.getItem('userName') } });
        }
        showToast('Change request sent to Host.');
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
      showToast('Subtitle loaded!');
    } catch (err) {
      showToast('Failed to load subtitle.');
    }
    e.target.value = '';
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        channel?.send({ type: 'broadcast', event: 'player:pause', payload: { currentTime: videoRef.current.currentTime } });
        syncToDatabase({ isPlaying: false, lastPosition: videoRef.current.currentTime });
      } else {
        videoRef.current.play().catch(e => console.error(e));
        channel?.send({ type: 'broadcast', event: 'player:play', payload: { currentTime: videoRef.current.currentTime } });
        syncToDatabase({ isPlaying: true, lastPosition: videoRef.current.currentTime });
      }
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      channel?.send({ type: 'broadcast', event: 'player:seek', payload: { currentTime: newTime } });
      syncToDatabase({ lastPosition: newTime });
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

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, togglePlay]);

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
      channel?.send({ type: 'broadcast', event: 'player:seek', payload: { currentTime: newTime } });
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x: touch.clientX };
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onProgress = () => {
      if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
    };
    
    const onMetadataLoaded = () => {
      if (initialSyncStateRef.current) {
        const { isPlaying: shouldPlay, currentTime: targetTime } = initialSyncStateRef.current;
        video.currentTime = targetTime;
        if (shouldPlay) video.play().catch(e => console.error(e));
        initialSyncStateRef.current = null;
      }
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('progress', onProgress);
    video.addEventListener('loadedmetadata', onMetadataLoaded);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('loadedmetadata', onMetadataLoaded);
    };
  }, [videoUrl, channel]);

  useEffect(() => {
    if (!isHost || !isPlaying || !channel) return;
    const interval = setInterval(() => {
      if (videoRef.current) {
        channel.send({ type: 'broadcast', event: 'player:heartbeat', payload: { currentTime: videoRef.current.currentTime } });
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isHost, isPlaying, channel]);

  const hostStateRef = useRef({ videoUrl: '', fileName: '', duration: 0, isPlaying: false });

  useEffect(() => {
    hostStateRef.current = { videoUrl, fileName, duration, isPlaying };
  }, [videoUrl, fileName, duration, isPlaying]);

  useEffect(() => {
    if (!isHost && channel) {
      const timer = setTimeout(() => {
        channel.send({ type: 'broadcast', event: 'player:request-sync', payload: {} });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isHost, channel]);

  useEffect(() => {
    if (!channel) return;
    let isActive = true;

    const onRemotePlay = (payload) => {
      if (!isActive) return;
      if (videoRef.current) {
        videoRef.current.currentTime = payload.payload.currentTime;
        videoRef.current.play().catch(e => {
          console.error("Autoplay blocked:", e);
          showToast("Host started playing. Click Play to sync!");
        });
      }
    };

    const onRemotePause = (payload) => {
      if (!isActive) return;
      if (videoRef.current) {
        videoRef.current.currentTime = payload.payload.currentTime;
        videoRef.current.pause();
      }
    };

    const onRemoteSeek = (payload) => {
      if (!isActive) return;
      if (videoRef.current) {
        videoRef.current.currentTime = payload.payload.currentTime;
      }
    };

    const onVideoInfo = (payload) => {
      if (!isActive) return;
      const p = payload.payload;
      setFileName(p.videoName);
      setDuration(p.videoDuration);
      setVideoUrl(p.videoUrl || p.videoName);
    };

    const onRemoteHeartbeat = (payload) => {
      if (!isActive || isHostRef.current || !videoRef.current) return;
      if (Math.abs(videoRef.current.currentTime - payload.payload.currentTime) > 2.5) {
        videoRef.current.currentTime = payload.payload.currentTime;
        showToast('Auto-syncing to host...');
      }
    };

    const onRequestChange = (payload) => {
      if (!isActive) return;
      const p = payload.payload;
      setConfirmRequest(p);
    };

    const onChangeRejected = (payload) => {
      if (!isActive) return;
      showToast(`Host rejected your video change request.`);
    };

    const onSyncRequest = () => {
      if (!isActive) return;
      if (isHostRef.current && videoRef.current && hostStateRef.current.videoUrl) {
         const { videoUrl: currentUrl, fileName: currentName, duration: currentDur, isPlaying: currentPlaying } = hostStateRef.current;
         channel.send({ type: 'broadcast', event: 'player:video-loaded', payload: { videoName: currentName, videoDuration: currentDur, videoUrl: currentUrl } });
         
         setTimeout(() => {
           if (videoRef.current) {
               if (currentPlaying) {
                   channel.send({ type: 'broadcast', event: 'player:play', payload: { currentTime: videoRef.current.currentTime } });
               } else {
                   channel.send({ type: 'broadcast', event: 'player:pause', payload: { currentTime: videoRef.current.currentTime } });
               }
           }
         }, 500);
      }
    };

    channel.on('broadcast', { event: 'player:play' }, onRemotePlay);
    channel.on('broadcast', { event: 'player:pause' }, onRemotePause);
    channel.on('broadcast', { event: 'player:seek' }, onRemoteSeek);
    channel.on('broadcast', { event: 'player:video-loaded' }, onVideoInfo);
    channel.on('broadcast', { event: 'player:heartbeat' }, onRemoteHeartbeat);
    channel.on('broadcast', { event: 'player:request-change' }, onRequestChange);
    channel.on('broadcast', { event: 'player:change-rejected' }, onChangeRejected);
    channel.on('broadcast', { event: 'player:request-sync' }, onSyncRequest);

    return () => {
      isActive = false;
    };
  }, [channel]);

  const handleConfirmResponse = (approved) => {
    if (!confirmRequest || !channel) return;
    if (approved) {
       setVideoUrl(confirmRequest.url);
       setFileName(confirmRequest.fileName);
       channel.send({ type: 'broadcast', event: 'player:video-loaded', payload: { videoName: confirmRequest.fileName, videoDuration: 0, videoUrl: confirmRequest.url } });
    } else {
       channel.send({ type: 'broadcast', event: 'player:change-rejected', payload: { rejectedBy: 'Host' } });
    }
    setConfirmRequest(null);
  };

  return (
    <div className={styles.container} ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={() => isPlaying && setShowControls(false)}>
      {toastMessage && <div className={styles.toastContainer}>{toastMessage}</div>}

      {confirmRequest && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <p>Guest <strong>"{confirmRequest.requesterName}"</strong> wants to change the video to: <strong>{confirmRequest.fileName}</strong> Approve?</p>
            <div className={styles.modalButtons}>
              <button className={`${styles.modalButton} ${styles.reject}`} onClick={() => handleConfirmResponse(false)}>Reject</button>
              <button className={`${styles.modalButton} ${styles.accept}`} onClick={() => handleConfirmResponse(true)}>Approve</button>
            </div>
          </div>
        </div>
      )}

      {isUploading ? (
        <div className={styles.placeholder}><h2>Uploading video to Cloudflare R2... (Please wait, this depends on your upload speed)</h2></div>
      ) : !videoUrl ? (
        <div className={styles.placeholder}>
          {isHost ? (
            <div className={styles.setupControls}>
              <h2>No video loaded</h2>
              <label className={styles.fileButton}>
                Upload Local File to Cloud
                <input type="file" accept="video/*" onChange={handleFileChange} hidden />
              </label>
              <form onSubmit={handleUrlSubmit} className={styles.urlForm}>
                <input type="url" name="url" placeholder="Or enter direct URL..." required />
                <label style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '14px'}}>
                  <input type="checkbox" name="manual" />
                  Raw / Bypass Converter
                </label>
                <button type="submit">Load URL</button>
              </form>
            </div>
          ) : (
            <div className={styles.setupControls}>
              <h2>Waiting for Host...</h2>
              <p>Please wait while the Host selects a video.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <video ref={videoRef} src={videoUrl} referrerPolicy="no-referrer" crossOrigin="anonymous" playsInline preload="auto" className={styles.video} onClick={togglePlay} onTouchStart={handleTouchStart}>
            {subtitleUrl && <track kind="subtitles" src={subtitleUrl} srcLang="en" label="Local Subtitle" default />}
          </video>
          <div className={`${styles.controlsOverlay} ${!showControls ? styles.hidden : ''}`}>
            <div className={styles.topBar}><span className={styles.fileName}>{getDisplayFileName(fileName)}</span></div>
            <div className={styles.bottomBar}>
              <div className={styles.progressContainer}>
                <div className={styles.bufferedBar} style={{ width: `${(buffered / (duration || 1)) * 100}%` }} />
                <input type="range" min={0} max={duration || 100} value={currentTime} onChange={handleSeek} className={styles.progressBar} />
              </div>
              <div className={styles.controlsRow}>
                <div className={styles.leftControls}>
                  <button onClick={togglePlay} className={styles.iconButton}>
                    {isPlaying ? <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>}
                  </button>
                  <div className={styles.volumeControl}>
                    <button onClick={toggleMute} className={styles.iconButton}>
                      {isMuted || volume === 0 ? <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg> : <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>}
                    </button>
                    <input type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume} onChange={handleVolumeChange} className={styles.volumeSlider} />
                  </div>
                  <span className={styles.timeDisplay}>{formatTime(currentTime)} / {formatTime(duration)}</span>
                </div>
                <div className={styles.rightControls}>
                  <label className={styles.changeFileButton}>Load Subtitle<input type="file" accept=".srt,.vtt" onChange={handleSubtitleChange} hidden /></label>
                  <label className={styles.changeFileButton}>Change Video<input type="file" accept="video/*" onChange={handleFileChange} hidden /></label>
                  <button onClick={toggleFullscreen} className={styles.iconButton}>
                    {isFullscreen ? <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg> : <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>}
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
