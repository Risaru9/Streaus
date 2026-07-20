import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sanitizeInput } from '@/lib/auth/sanitizers';
import { validateEmail } from '@/lib/auth/validators';
import { loginUser } from '@/lib/auth/authService';

export async function POST(request) {
  try {
    const body = await request.json();
    
    // 1. Sanitasi email di sisi server
    const email = sanitizeInput(body.email);
    const password = body.password; // Karakter password tidak disanitasi

    // 2. Validasi input di sisi server
    if (!email || !validateEmail(email)) {
      return NextResponse.json(
        { error: 'Email wajib diisi dengan format yang benar.' }, 
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: 'Password wajib diisi.' }, 
        { status: 400 }
      );
    }

    // 3. Verifikasi login ke database/Supabase
    const { user, session, error } = await loginUser(email, password);

    if (error) {
      // Mengembalikan error generik aman (tidak mengungkapkan email/password mana yang salah)
      return NextResponse.json({ error }, { status: 401 });
    }

    // 4. Buat cookie session HttpOnly, Secure, dan SameSite=Lax
    const cookieStore = await cookies();
    
    // Simpan access token
    cookieStore.set('watchparty-access-token', session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: session.expires_in,
    });

    // Simpan refresh token (biasanya berumur lebih panjang untuk memperbarui session)
    cookieStore.set('watchparty-refresh-token', session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 hari
    });

    return NextResponse.json({
      success: true,
      message: 'Login berhasil.',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name || email.split('@')[0],
      },
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }
    }, { status: 200 });

  } catch (err) {
    console.error('API Login Error:', err);
    return NextResponse.json(
      { error: 'Gagal melakukan login pada server.' }, 
      { status: 500 }
    );
  }
}
