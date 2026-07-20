# Fitur Baru: Hapus Otomatis R2, Poles UI/UX, dan Login Google

Rencana ini merangkum tiga fitur besar yang Anda minta untuk menyempurnakan aplikasi Streaus.

## User Review Required

> [!IMPORTANT]  
> **Konfigurasi Google Login di Supabase:** Untuk mengaktifkan Google Login, Anda *wajib* melakukan konfigurasi di Google Cloud Platform (GCP) dan Supabase Dashboard Anda. Saya akan memberikan panduan langkah demi langkahnya di akhir setelah rencana ini disetujui, karena ini membutuhkan tindakan manual dari Anda (membuat OAuth Client ID & Secret). Apakah Anda siap untuk melakukan konfigurasi manual ini?

> [!WARNING]  
> **Penghapusan Video Otomatis (R2):** Menghapus video saat *Host* keluar dari *room* mengandalkan *event* peramban (seperti mengklik tombol "Leave" atau menutup *tab*). Jika peramban ditutup secara paksa (crash) atau internet terputus mendadak, permintaan hapus mungkin tidak terkirim. Apakah pendekatan ini cukup baik, atau Anda ingin saya menambahkan sistem penjadwalan (Cron Job) harian untuk membersihkan video-video lawas?

## Proposed Changes

---

### 1. Auto-Delete Video di Cloudflare R2

Kita akan membuat *endpoint* API baru untuk menghapus file dari R2, dan memicu *endpoint* tersebut saat *Host* mengganti video atau keluar dari *room*.

#### [MODIFY] [route.js](file:///d:/Streaming_couple/src/app/api/upload/route.js)
- Menambahkan metode `DELETE` yang menerima URL video.
- Mengekstrak `Key` (nama file) dari URL dan menggunakan `DeleteObjectCommand` dari AWS SDK untuk menghapus file tersebut dari Cloudflare R2 secara permanen.

#### [MODIFY] [VideoPlayer.jsx](file:///d:/Streaming_couple/src/components/VideoPlayer.jsx)
- Menambahkan fungsi `deleteCurrentVideo()` yang memanggil API `DELETE /api/upload`.
- Memicu fungsi ini setiap kali *Host* mengunggah video baru (untuk menghapus video lama yang tergantikan).
- Memanfaatkan *event listener* `beforeunload` (saat tab ditutup/direfresh) dan `componentWillUnmount` untuk memicu penghapusan saat *Host* keluar dari *room*.

---

### 2. Integrasi Login dengan Google (OAuth)

Kita akan merombak halaman otentikasi agar mendukung masuk dengan satu klik menggunakan Google.

#### [MODIFY] [login/page.js](file:///d:/Streaming_couple/src/app/login/page.js) & [register/page.js](file:///d:/Streaming_couple/src/app/register/page.js)
- Menambahkan tombol "Sign in with Google" bergaya premium.
- Mengimplementasikan `supabase.auth.signInWithOAuth({ provider: 'google' })`.

---

### 3. Pemolesan UI/UX (Desain Premium)

Kita akan mengubah tampilan aplikasi dari yang sekadar fungsional menjadi *Wow!* dengan menerapkan tren desain web modern: *Glassmorphism*, gradien dinamis, dan efek *hover* yang hidup.

#### [MODIFY] [globals.css](file:///d:/Streaming_couple/src/app/globals.css) & [page.module.css](file:///d:/Streaming_couple/src/app/page.module.css)
- Mengubah warna latar belakang menjadi gradien gelap (*Deep Space* atau *Midnight Purple*).
- Memperbarui tipografi.

#### [MODIFY] [VideoPlayer.module.css](file:///d:/Streaming_couple/src/components/VideoPlayer.module.css) & [Room.module.css](file:///d:/Streaming_couple/src/app/room/[id]/page.module.css)
- Menambahkan efek *Glassmorphism* (latar belakang semi-transparan dengan *blur*) pada panel *Chat*, *Users*, dan *Queue*.
- Mengubah warna tombol (*Change Video*, *Load Subtitle*, *Leave Room*) agar lebih interaktif dengan animasi mikro (membesar/menyala saat disorot).
- Merapikan tata letak (*layout*) *Video Player* agar terlihat lebih sinematik (menghilangkan garis tepi kasar, menambahkan bayangan halus/ *glow*).

## Verification Plan

### Manual Verification
1. **Hapus Otomatis:** Mengunggah video, lalu kembali ke beranda. Memeriksa dasbor R2 Anda untuk memastikan file tersebut benar-benar lenyap.
2. **UI/UX:** Meninjau antarmuka secara visual.
3. **Google Login:** Mengklik tombol Google Login dan memastikan *popup* otentikasi Google muncul dengan benar (setelah Anda melakukan *setup* OAuth).
