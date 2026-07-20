import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const { roomId, hostSecret } = await req.json();

    if (!roomId || !hostSecret) {
      return Response.json({ error: 'roomId and hostSecret are required' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const host_id_hash = crypto.createHash('sha256').update(hostSecret).digest('hex');

    const { error } = await supabaseAdmin.from('rooms').insert({
      id: roomId,
      host_id_hash,
      video_url: null,
      video_name: null,
      last_position: 0,
      is_playing: false
    });

    if (error) {
      if (error.code === '23505') {
        // Unique violation means the room already exists
        return Response.json({ error: 'Room already exists' }, { status: 409 });
      }
      throw error;
    }

    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Error creating room:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
