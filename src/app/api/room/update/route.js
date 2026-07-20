import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const { roomId, hostSecret, videoUrl, videoName, lastPosition, isPlaying } = await req.json();

    if (!roomId || !hostSecret) {
      return Response.json({ error: 'roomId and hostSecret are required' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Verify host
    const { data: room, error: fetchError } = await supabaseAdmin
      .from('rooms')
      .select('host_id_hash')
      .eq('id', roomId)
      .single();

    if (fetchError || !room) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }

    const incomingHash = crypto.createHash('sha256').update(hostSecret).digest('hex');
    if (incomingHash !== room.host_id_hash) {
      return Response.json({ error: 'Unauthorized: Invalid host secret' }, { status: 401 });
    }

    // Build update payload
    const payload = { updated_at: new Date().toISOString() };
    if (videoUrl !== undefined) payload.video_url = videoUrl;
    if (videoName !== undefined) payload.video_name = videoName;
    if (lastPosition !== undefined) payload.last_position = lastPosition;
    if (isPlaying !== undefined) payload.is_playing = isPlaying;

    const { error: updateError } = await supabaseAdmin
      .from('rooms')
      .update(payload)
      .eq('id', roomId);

    if (updateError) throw updateError;

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error updating room:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
