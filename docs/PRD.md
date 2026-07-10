# Project Requirements Document (PRD)
## Aplikasi Manajemen Kedai Kopi — Versi Mandiri

---

## 1. Overview

Aplikasi manajemen operasional untuk kedai kopi yang mencakup pencatatan keuangan, manajemen inventaris bahan baku, dan kalkulasi HPP (Harga Pokok Produksi) serta keuntungan per menu secara otomatis. Aplikasi ditujukan untuk digunakan oleh satu pemilik usaha (single-user), dengan kemungkinan pengembangan multi-user di masa depan.

**Target platform:** Web app responsive — dapat diakses langsung melalui browser baik dari HP maupun desktop/laptop, tanpa perlu instalasi.

**Tujuan utama:**
- Menggantikan pencatatan manual (buku/Excel) dengan sistem yang otomatis menghitung HPP, untung, dan mengelola stok
- Memberikan visibilitas real-time terhadap kondisi keuangan dan stok kedai
- Meminimalisir human error dalam pencatatan transaksi dan pengurangan stok

---

## 2. User & Konteks Penggunaan

- **Pengguna:** Pemilik kedai kopi (single-user untuk versi awal)
- **Device:** HP (utama, saat operasional harian) dan browser desktop/laptop (untuk pengecekan laporan/setup data) — aplikasi yang sama, layout menyesuaikan otomatis (responsive)
- **Frekuensi akses:** Harian, terutama saat jam operasional kedai (input transaksi) dan malam hari (tutup kasir)

---

## 3. Core Features

### 3.1 Inventaris (Manajemen Stok Bahan Baku)
- CRUD data bahan baku: nama, satuan (gram/ml/pcs), harga per satuan, jumlah stok saat ini
- **Riwayat harga bahan** — setiap perubahan harga bahan tersimpan sebagai histori, sehingga HPP transaksi lama tetap menggunakan harga yang berlaku saat transaksi terjadi (tidak berubah retroaktif)
- **Stock Masuk** — pencatatan pembelian bahan baku, otomatis:
  - Menambah jumlah stok bahan terkait
  - Membuat entri pengeluaran di modul Keuangan
- **Notifikasi stok menipis** — warning ditampilkan ketika stok bahan berada di bawah batas minimum yang ditentukan pengguna per bahan

### 3.2 Menu Management
- CRUD data menu, dengan atribut:
  - Nama menu
  - **Kategori** (kopi, non-kopi, snack, atau kategori custom lain)
  - Resep — daftar bahan baku dan takaran yang dibutuhkan (multi-bahan per menu)
  - Harga jual
- **Kalkulasi HPP otomatis** — dihitung dari total (harga bahan × takaran) sesuai resep
- **Kalkulasi keuntungan otomatis** — harga jual − HPP, ditampilkan per menu

### 3.3 Transaksi Penjualan
- Input penjualan per pesanan: pilih menu + jumlah
- **Preset jumlah cepat** — tombol pintas (+1/+5) untuk mempercepat input saat kondisi ramai
- Saat transaksi disimpan, sistem otomatis:
  - Mengurangi stok bahan baku sesuai resep menu yang terjual
  - Mencatat pemasukan di modul Keuangan
- **Void/Batal transaksi** — membatalkan transaksi yang sudah diinput, dengan otomatis mengembalikan stok bahan baku ke kondisi semula

### 3.4 Keuangan
- Mencatat seluruh pemasukan (dari transaksi penjualan) dan pengeluaran (dari stock masuk)
- Riwayat transaksi keuangan, dapat difilter berdasarkan tanggal/periode

### 3.5 Tutup Kasir Harian
- Ringkasan otomatis di akhir hari operasional, mencakup:
  - Total penjualan (omzet)
  - Total pengeluaran
  - Menu terlaris hari itu
  - Laba kotor harian

### 3.6 Laporan
- **Laporan Laba-Rugi** — ringkasan pemasukan vs pengeluaran per periode (harian/mingguan/bulanan)
- **Menu Terlaris** — ranking menu berdasarkan jumlah terjual, dapat difilter per kategori
- **Menu Paling Untung / Boncos** — ranking menu berdasarkan margin keuntungan

---

## 4. Out of Scope (Versi Awal)

Fitur berikut secara sadar tidak dimasukkan ke versi awal, untuk menjaga aplikasi tetap sederhana:

- Pengeluaran operasional non-bahan baku (listrik, gas, sewa, gaji)
- Integrasi WhatsApp untuk input/laporan
- Multi-user / manajemen role (kasir, admin, dll)
- Aplikasi mobile native (Android/iOS via app store)
- Grafik tren dan perbandingan antar periode
- Export/backup data manual

*(Catatan: fitur-fitur ini dapat dipertimbangkan untuk pengembangan lanjutan setelah versi awal digunakan dan dievaluasi.)*

---

## 5. User Flow (Ringkas)

```
[Beli Bahan Baku]
      |
      v
[Stock Masuk] --> (+ Stok Inventaris) --> (Pengeluaran tercatat di Keuangan)

[Setup Menu]
      |
      v
[Resep: Bahan + Takaran] --> [HPP Otomatis] --> [Harga Jual] --> [Untung Otomatis]

[Transaksi Penjualan]
      |
      v
[Pilih Menu + Qty] --> (- Stok Inventaris sesuai resep) --> (Pemasukan tercatat di Keuangan)
      |
      v
[Void jika salah input] --> (Stok & Keuangan dikembalikan)

[Akhir Hari]
      |
      v
[Tutup Kasir] --> [Ringkasan Harian]

[Kapan saja]
      |
      v
[Laporan] --> [Laba-Rugi / Menu Terlaris / Menu Paling Untung-Boncos]
```

---

## 6. Data Model (Skema Database — Ringkas)

**bahan_baku**
- id, nama, satuan (gram/ml/pcs), stok_saat_ini, batas_minimum_stok

**riwayat_harga_bahan**
- id, bahan_baku_id, harga_per_satuan, berlaku_sejak

**menu**
- id, nama, kategori, harga_jual

**resep_menu**
- id, menu_id, bahan_baku_id, takaran

**transaksi**
- id, tanggal, total_pemasukan, status (aktif/void)

**detail_transaksi**
- id, transaksi_id, menu_id, qty, harga_jual_saat_itu, hpp_saat_itu

**stock_masuk**
- id, tanggal, bahan_baku_id, qty, harga_beli, total_pengeluaran

**tutup_kasir**
- id, tanggal, total_penjualan, total_pengeluaran, laba_kotor, menu_terlaris_id

---

## 7. Tech Stack (Rekomendasi — Versi Mandiri)

| Layer | Teknologi | Alasan |
|---|---|---|
| Frontend | Next.js + Tailwind CSS + shadcn/ui | Struktur predictable, mudah dikembangkan dengan AI coding agent, responsive out-of-the-box |
| Backend | Next.js API Route Handlers | Full-stack dalam satu codebase, tidak perlu server terpisah |
| ORM | Drizzle ORM | Migration & query yang mudah dikelola, ringan |
| Database | PostgreSQL | Relasional, cocok untuk data transaksi & laporan keuangan |
| Auth | Better Auth | Simpel disetup, cukup untuk single-user, siap dikembangkan ke multi-user |
| Hosting Database | Supabase (free tier) atau VPS mandiri | Managed database, tidak perlu maintenance server manual |
| Hosting Web App | Vercel (free tier) | Auto-deploy dari GitHub, gratis untuk skala penggunaan personal |
| Responsive Design | Tailwind CSS breakpoints | Satu codebase, layout otomatis menyesuaikan dari layar HP hingga desktop |

**Catatan platform:**
- Satu web app, satu codebase — dapat diakses langsung dari browser HP maupun browser desktop/laptop tanpa instalasi apa pun
- Layout dirancang mobile-first, dengan penyesuaian tampilan (misal navigasi, jumlah kolom, ukuran elemen) saat dibuka di layar yang lebih lebar (desktop)

---

## 8. Referensi Desain UI (Halaman & Komponen)

Referensi visual (UI reference kit "Teras Coffee Operations") dipakai sebagai acuan gaya (bahasa desain, warna, tipografi). Susunan halaman & komponen di bawah ini disesuaikan agar 1:1 dengan fitur yang sudah disepakati di Bagian 3 — tidak menambah scope baru.

**Bahasa desain (diambil dari referensi):**
- Gaya: Corporate/Modern, clean, banyak white space, cocok dipakai cepat saat jam sibuk
- Warna: Primary Blue (#2563EB) untuk aksi utama & navigasi aktif, background off-white (#F9FAFB), card putih dengan border tipis + shadow lembut
- Badge status pakai warna semantik: hijau (untung/aman), kuning (stok menipis), merah (kritis/rugi)
- Tipografi: Inter untuk teks umum, Geist untuk angka/stat besar (harga, HPP, omzet)
- Layout: sidebar tetap 260px di desktop → collapse jadi bottom nav/hamburger di HP (selaras dengan pendekatan responsive di Bagian 7)

**Struktur navigasi (7 halaman, sesuai modul di Bagian 3):**

### 8.1 Dashboard (Beranda)
Halaman ringkasan saat aplikasi dibuka — gabungan data dari modul lain, bukan modul baru:
- Kartu ringkasan: Omzet hari ini, Laba kotor hari ini, jumlah bahan yang stoknya menipis
- Panel "Peringatan Inventaris" — daftar bahan di bawah batas minimum (dari 3.1)
- Panel "Menu Terlaris Hari Ini" (ringkasan singkat dari 3.6)
- Shortcut ke aksi yang sering dipakai: input Transaksi baru, input Stock Masuk

### 8.2 Inventaris (mengacu 3.1)
- Daftar bahan baku berbentuk tabel/list: nama, satuan, stok saat ini, badge status (Aman/Menipis/Kritis)
- Search/filter bahan
- Tombol "+ Bahan Baru" dan "+ Stock Masuk"
- Detail bahan menampilkan riwayat harga (histori harga per satuan dari waktu ke waktu)

### 8.3 Menu (mengacu 3.2)
- Daftar menu dalam bentuk card, dikelompokkan per kategori (kopi/non-kopi/snack/custom)
- Tiap card menampilkan: nama menu, harga jual, HPP (otomatis), keuntungan (otomatis)
- Form tambah/edit menu: input resep multi-bahan (pilih bahan baku + takaran per bahan)

### 8.4 Transaksi / Kasir (mengacu 3.3)
- Grid pilihan menu (bisa difilter per kategori) untuk input cepat
- Tombol preset qty (+1/+5) di tiap item
- Panel "Ringkasan Pesanan" (keranjang) menampilkan menu terpilih + total
- Tombol simpan transaksi, dan akses ke Void/Batal transaksi

### 8.5 Keuangan (mengacu 3.4)
- Kartu ringkasan: total pemasukan, total pengeluaran, saldo/laba
- Riwayat transaksi keuangan (list), dengan filter tanggal/periode
- Badge/tag pembeda antara entri pemasukan (dari transaksi) dan pengeluaran (dari stock masuk)

### 8.6 Tutup Kasir (mengacu 3.5)
- Kartu "Data Harian Terakhir": total penjualan, total pengeluaran, laba kotor, menu terlaris hari itu
- Riwayat Tutup Kasir per hari sebelumnya
- Tombol aksi "Tutup Kasir Hari Ini"

### 8.7 Laporan (mengacu 3.6)
- Laporan Laba-Rugi per periode (harian/mingguan/bulanan) — dipilih lewat filter periode, ditampilkan sebagai ringkasan angka (bukan grafik tren antar periode, karena masih di luar scope versi awal)
- Ranking Menu Terlaris, dapat difilter per kategori
- Ranking Menu Paling Untung/Boncos berdasarkan margin

**Catatan penyesuaian dari referensi asli:**
- Referensi awal memuat elemen "Breakdown Biaya" bergaya pie chart untuk biaya non-bahan baku (listrik, gas, sewa, gaji) — ini disederhanakan/dihapus karena pengeluaran non-bahan baku masih *out of scope* (Bagian 4)
- Grafik tren/perbandingan antar periode pada referensi tidak dipakai dulu di versi awal, mengikuti keputusan out-of-scope yang sama

---

## 9. Success Metrics (Indikator Keberhasilan)

- Seluruh transaksi harian tercatat tanpa perlu pencatatan manual ganda (buku/Excel)
- HPP dan keuntungan per menu dapat dilihat kapan saja tanpa kalkulasi manual
- Notifikasi stok menipis membantu mencegah kehabisan bahan baku mendadak
- Laporan laba-rugi dapat diakses dan dipahami dalam hitungan detik

---

## 10. Roadmap Pengembangan (Saran Bertahap)

1. **Fase 1 (MVP):** Inventaris, Menu, Transaksi, Keuangan dasar — web app responsive (mobile & desktop browser)
2. **Fase 2:** Tutup Kasir Harian, Laporan lengkap
3. **Fase 3 (jika dibutuhkan):** Multi-user/role kasir, pengeluaran operasional non-bahan, grafik tren, export data