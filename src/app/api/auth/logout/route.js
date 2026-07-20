import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logoutUser } from '@/lib/auth/authService';

export async function POST() {
  try {
    // 1. Panggil service logout untuk membersihkan session di Supabase
    await logoutUser();

    // 2. Hapus cookies dengan menyetel maxAge ke 0
    const cookieStore = await cookies();
    cookieStore.set('watchparty-access-token', '', { path: '/', maxAge: 0 });
    cookieStore.set('watchparty-refresh-token', '', { path: '/', maxAge: 0 });

    return NextResponse.json({ success: true, message: 'Berhasil logout.' }, { status: 200 });
  } catch (err) {
    console.error('API Logout Error:', err);
    return NextResponse.json({ error: 'Gagal melakukan logout pada server.' }, { status: 500 });
  }
}
