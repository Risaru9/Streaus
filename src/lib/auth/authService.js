import { supabase } from '@/lib/supabase';

/**
 * Service layer for managing user authentication and secure error handling.
 */

/**
 * Maps Supabase auth error messages to secure, user-friendly Indonesian messages.
 * Prevents enumeration attacks by not leaking if email or password is the incorrect field.
 * 
 * @param {object} supabaseError 
 * @returns {string}
 */
export function mapAuthError(supabaseError) {
  if (!supabaseError) return null;

  // Log error on server for debugging
  console.error("Supabase Auth Error detailed:", supabaseError);

  const msg = supabaseError.message || '';
  const status = supabaseError.status;

  // Check for email confirmation error
  if (
    msg.toLowerCase().includes('confirm') ||
    msg.toLowerCase().includes('not confirmed') ||
    msg.toLowerCase().includes('verification')
  ) {
    return 'Email belum dikonfirmasi. Silakan periksa kotak masuk atau spam email Anda untuk memverifikasi akun.';
  }

  // Generic message for bad credentials
  if (
    msg.toLowerCase().includes('invalid grant') ||
    msg.toLowerCase().includes('invalid credentials') ||
    msg.toLowerCase().includes('credentials') ||
    msg.toLowerCase().includes('invalid login') ||
    msg.toLowerCase().includes('not found') ||
    msg.toLowerCase().includes('incorrect')
  ) {
    return 'Email atau password salah.';
  }

  if (msg.toLowerCase().includes('email rate limit')) {
    return 'Terlalu banyak percobaan masuk/daftar. Silakan coba beberapa saat lagi.';
  }

  if (msg.toLowerCase().includes('user already exists') || status === 422) {
    return 'Email ini sudah terdaftar. Silakan gunakan email lain atau masuk.';
  }

  if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
    return 'Koneksi gagal. Periksa koneksi internet Anda.';
  }

  // Safe fallback
  return 'Terjadi kesalahan sistem. Silakan coba lagi.';
}

/**
 * Logs a user in with their email and password.
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{user: object, session: object, error: string}>}
 */
export async function loginUser(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { user: null, session: null, error: mapAuthError(error) };
    }

    return { user: data.user, session: data.session, error: null };
  } catch (err) {
    console.error('Service error during login:', err);
    return { user: null, session: null, error: 'Gagal melakukan login.' };
  }
}

/**
 * Registers a new user with their name, email, and password.
 * Name is saved to Supabase auth user metadata.
 * @param {string} fullName 
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{user: object, error: string}>}
 */
export async function registerUser(fullName, email, password) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      return { user: null, error: mapAuthError(error) };
    }

    return { user: data.user, error: null };
  } catch (err) {
    console.error('Service error during registration:', err);
    return { user: null, error: 'Gagal melakukan pendaftaran.' };
  }
}

/**
 * Sign out the currently logged in user.
 * @returns {Promise<{error: string}>}
 */
export async function logoutUser() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  } catch (err) {
    console.error('Service error during logout:', err);
    return { error: 'Gagal keluar sistem.' };
  }
}
