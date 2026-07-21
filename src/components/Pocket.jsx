'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './Pocket.module.css';

export default function Pocket({ user, onSelectVideo }) {
  const [videos, setVideos] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) fetchPocketVideos();
  }, [user]);

  const fetchPocketVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('user_videos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (err) {
      console.error('Error fetching pocket videos:', err);
      setError('Gagal memuat daftar video dari Pocket.');
    }
  };

  const handlePocketUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    setIsUploading(true);
    setError(null);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          filename: file.name, 
          contentType: file.type || 'video/mp4',
          isPocket: true,
          userId: user.id
        })
      });

      if (!res.ok) throw new Error('Gagal mendapatkan URL upload');

      const { presignedUrl, publicUrl } = await res.json();

      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'video/mp4' },
        body: file
      });

      if (!uploadRes.ok) throw new Error('Gagal mengunggah video ke R2');

      const { error: dbError } = await supabase
        .from('user_videos')
        .insert([{
          user_id: user.id,
          video_name: file.name,
          video_url: publicUrl
        }]);

      if (dbError) throw dbError;

      await fetchPocketVideos(); // Refresh list
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleDelete = async (videoId, videoUrl) => {
    try {
      // Delete from R2
      await fetch(`/api/upload?fileUrl=${encodeURIComponent(videoUrl)}`, { method: 'DELETE' });

      // Delete from DB
      const { error } = await supabase
        .from('user_videos')
        .delete()
        .eq('id', videoId);

      if (error) throw error;

      await fetchPocketVideos();
    } catch (err) {
      console.error('Gagal menghapus video:', err);
      alert('Gagal menghapus video.');
    }
  };

  if (!user) return null;

  return (
    <div className={styles.pocketContainer}>
      <div className={styles.pocketHeader}>
        <h2>🎒 My Pocket</h2>
        <label className="btn btn-secondary" style={{ padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem' }}>
          {isUploading ? 'Uploading...' : '+ Tambah Video'}
          <input type="file" accept="video/*" onChange={handlePocketUpload} disabled={isUploading} hidden />
        </label>
      </div>

      {error && <div style={{ color: '#FF4D4D', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

      <div className={styles.videoList}>
        {videos.length === 0 && !isUploading && (
          <div className={styles.emptyState}>
            Pocket Anda masih kosong. Unggah video sekarang untuk ditonton nanti!
          </div>
        )}
        
        {videos.map(video => (
          <div key={video.id} className={styles.videoCard}>
            <div className={styles.videoInfo}>
              <div className={styles.videoName}>{video.video_name}</div>
              <div className={styles.videoDate}>{new Date(video.created_at).toLocaleDateString()}</div>
            </div>
            <div className={styles.videoActions}>
              {onSelectVideo && (
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                  onClick={() => onSelectVideo(video)}
                >
                  Pilih
                </button>
              )}
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', backgroundColor: '#333' }}
                onClick={() => handleDelete(video.id, video.video_url)}
              >
                Hapus
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
