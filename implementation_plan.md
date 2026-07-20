# Rencana Implementasi: Fitur Baru dari Referensi Stitch

Berdasarkan gambar desain dari direktori `D:\DW\stitch`, saya telah mengidentifikasi beberapa fitur besar dan perombakan UI yang sangat ambisius dan modern. Rencana ini akan membawa Streaus dari sekadar "alat *nobar*" menjadi **Platform *Watch Party* Premium sekelas Netflix/Teleparty**.

## User Review Required

> [!IMPORTANT]  
> **1. Sumber Data Video Discovery Library:** Di desain, terdapat katalog "Trending Movies" dengan poster film asli (Dune, Oppenheimer, dll). Apakah Anda ingin saya menggunakan **TMDB API** (The Movie Database) secara gratis untuk menarik data film asli ini? Jika ya, kita membutuhkan API Key TMDB nanti. Ataukah Anda hanya ingin data *dummy* (palsu) sementara?

> [!IMPORTANT]  
> **2. Pemutaran Film Asli:** Jika pengguna menekan "Start Party with this Video" pada film *Dune: Part Two*, dari mana sumber videonya berasal? Apakah Anda memiliki API penyedia film bajakan/gratisan, atau sekadar memutar *Trailer* dari YouTube saja?

> [!WARNING]  
> **3. Bentuk Landing Page:** Sebelumnya Anda meminta desain **Tiket Bioskop**. Namun di gambar referensi, desainnya berubah menjadi **Kotak Neon (Glowing Borders)** berlatar belakang gulungan pita film. Apakah Anda ingin saya **membuang desain Tiket Bioskop** yang baru saya buat dan menggantinya persis seperti gambar `modern_watch_party_lobby`?

## Proposed Changes

---

### 1. Fitur *Floating Reactions* (Reaksi Mengambang)
Terinspirasi dari Facebook Live / Instagram Live.
#### [MODIFY] [VideoPlayer.jsx](file:///d:/Streaming_couple/src/components/VideoPlayer.jsx)
- Menambahkan bilah reaksi di dalam kontrol video (👍, ❤️, 😂, 😮, 😢, 😡).
- Mengirimkan *event* `player:reaction` melalui Supabase Realtime *broadcast*.
- Membuat sistem partikel CSS untuk memunculkan emoji yang melayang ke atas dan menghilang perlahan di atas video saat ada anggota yang menekan reaksi.

### 2. Pengepakan Ulang UI Video Player (Dashboard Desktop & Mobile)
#### [MODIFY] [room/[id]/page.js](file:///d:/Streaming_couple/src/app/room/[id]/page.js) & [VideoPlayer.jsx](file:///d:/Streaming_couple/src/components/VideoPlayer.jsx)
- Memindahkan tombol "Invite" dan "Viewer Count" langsung ke dalam video (bersama kontrol lainnya).
- Mengubah warna-warna *chat* agar menggunakan skema teks kuning/abu-abu sesuai gambar referensi.
- Membuat tata letak *mobile* di mana *chat* dan *video queue* bertumpuk (*stacked*) secara vertikal dan bisa di-*toggle*.

### 3. Video Discovery Library (Halaman Baru)
#### [NEW] [library/page.js](file:///d:/Streaming_couple/src/app/library/page.js)
- Membuat halaman baru dengan struktur tiga bagian (seperti di desain): 
  1. *Trending Movies* (Grid Poster Film)
  2. *YouTube Search*
  3. *Upload File (Drag & Drop)*
- Saat film diklik, akan muncul tombol kuning "Start Party with this Video" di atas poster (efek *hover*).

## Verification Plan

### Manual Verification
- **Reaksi:** Menguji menekan emoji di satu jendela peramban, dan melihat emoji melayang secara waktu nyata (*real-time*) di jendela lain.
- **Library:** Memastikan transisi *hover* poster film mulus dan berhasil membuat *room* baru.
- **Responsivitas:** Mengecek tata letak *dashboard* di layar kecil (HP) untuk memastikan tidak ada elemen yang tumpang tindih.
