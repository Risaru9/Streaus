import { NextResponse } from 'next/server';
import { sanitizeInput } from '@/lib/auth/sanitizers';
import { validateEmail, validatePasswordStrength, validateFullName, validateConfirmPassword } from '@/lib/auth/validators';
import { registerUser } from '@/lib/auth/authService';

export async function POST(request) {
  try {
    const body = await request.json();
    
    // 1. Sanitasi input di sisi server
    const fullName = sanitizeInput(body.fullName);
    const email = sanitizeInput(body.email);
    const password = body.password; // Jangan disanitasi agar karakter password tidak berubah
    const confirmPassword = body.confirmPassword;

    // 2. Validasi input di sisi server
    if (!fullName || !validateFullName(fullName)) {
      return NextResponse.json(
        { error: 'Nama lengkap wajib diisi dengan huruf & spasi (minimal 2 karakter).' }, 
        { status: 400 }
      );
    }

    if (!email || !validateEmail(email)) {
      return NextResponse.json(
        { error: 'Format email tidak valid.' }, 
        { status: 400 }
      );
    }

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.isValid) {
      return NextResponse.json(
        { error: passwordCheck.errors[0] }, 
        { status: 400 }
      );
    }

    if (!validateConfirmPassword(password, confirmPassword)) {
      return NextResponse.json(
        { error: 'Konfirmasi password tidak cocok.' }, 
        { status: 400 }
      );
    }

    // 3. Daftarkan user ke database
    const { user, error } = await registerUser(fullName, email, password);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json(
      { success: true, message: 'Pendaftaran berhasil. Silakan login.', userId: user.id }, 
      { status: 201 }
    );

  } catch (err) {
    console.error('API Register Error:', err);
    return NextResponse.json(
      { error: 'Gagal melakukan pendaftaran pada server.' }, 
      { status: 500 }
    );
  }
}
