# CLAUDE.md — Aplikasi Manajemen Kedai Kopi (Teras Coffee)

Dokumen ini adalah panduan kerja untuk Claude Code saat membangun aplikasi ini. Baca PRD lengkap di `docs/PRD-Aplikasi-Kedai-Kopi.md` sebelum mulai — file ini hanya ringkasan eksekusi + aturan teknis.

## 1. Ringkasan Produk

Web app responsive (mobile & desktop, satu codebase) untuk **satu pemilik kedai kopi (single-user)**. Fungsi utama: catat transaksi penjualan, kelola stok bahan baku, hitung HPP & keuntungan per menu secara otomatis, catat keuangan, tutup kasir harian, dan laporan performa.

**Prinsip penting yang TIDAK BOLEH dilanggar:**
- Ini versi single-user. Jangan bangun sistem role/permission kompleks.
- Riwayat harga bahan baku wajib disimpan sebagai histori — HPP transaksi lama **tidak boleh berubah retroaktif** saat harga bahan berubah di kemudian hari.
- Setiap transaksi penjualan otomatis mengurangi stok sesuai resep menu, dan otomatis mencatat pemasukan di Keuangan. Jangan buat dua proses ini terpisah/manual.
- Void transaksi wajib mengembalikan stok bahan baku ke kondisi semula.
- Stock Masuk otomatis menambah stok bahan DAN membuat entri pengeluaran di Keuangan.
- Jangan menambah fitur di luar scope tanpa konfirmasi (lihat Bagian 6).

## 2. Tech Stack (wajib diikuti, jangan ganti tanpa alasan kuat)

| Layer | Teknologi |
|---|---|
| Frontend | Next.js (App Router) + Tailwind CSS + shadcn/ui |
| Backend | Next.js API Route Handlers (full-stack satu codebase) |
| ORM | Drizzle ORM |
| Database | PostgreSQL (dev: lokal/Docker, prod: Supabase) |
| Auth | Better Auth (single-user, tapi tetap ada login agar siap dikembangkan ke multi-user nanti) |
| Hosting | Vercel (web app), Supabase (database) |

**Setup awal yang harus dijalankan Claude Code:**
1. Inisialisasi Next.js (TypeScript, App Router, Tailwind) di root project
2. Install & init shadcn/ui
3. Setup Drizzle ORM + koneksi PostgreSQL, siapkan `drizzle.config.ts` dan folder `db/schema`
4. Setup Better Auth dengan satu akun owner
5. Buat struktur folder halaman sesuai Bagian 4

## 3. Data Model

Implementasikan sebagai Drizzle schema di `db/schema/`:

```
bahan_baku
  id, nama, satuan (gram/ml/pcs), stok_saat_ini, batas_minimum_stok

riwayat_harga_bahan
  id, bahan_baku_id (FK), harga_per_satuan, berlaku_sejak

menu
  id, nama, kategori, harga_jual

resep_menu
  id, menu_id (FK), bahan_baku_id (FK), takaran

transaksi
  id, tanggal, total_pemasukan, status (aktif/void)

detail_transaksi
  id, transaksi_id (FK), menu_id (FK), qty, harga_jual_saat_itu, hpp_saat_itu

stock_masuk
  id, tanggal, bahan_baku_id (FK), qty, harga_beli, total_pengeluaran

tutup_kasir
  id, tanggal, total_penjualan, total_pengeluaran, laba_kotor, menu_terlaris_id
```

Catatan implementasi:
- `detail_transaksi` menyimpan `harga_jual_saat_itu` dan `hpp_saat_itu` sebagai snapshot — jangan hitung ulang dari tabel `menu`/`riwayat_harga_bahan` saat menampilkan riwayat transaksi lama.
- HPP menu (real-time, untuk halaman Menu) dihitung dari SUM(takaran × harga_per_satuan terbaru dari `riwayat_harga_bahan`) per bahan di resep.
- Saat Stock Masuk disimpan: insert baris baru ke `riwayat_harga_bahan` (jika harga beli berbeda dari harga berlaku), update `stok_saat_ini` di `bahan_baku`, insert baris di `stock_masuk`, insert entri pengeluaran (baik sebagai tabel keuangan terpisah atau view dari `stock_masuk` — pilih salah satu pendekatan lalu konsisten).
- Keuangan bisa diimplementasi sebagai **view/gabungan** dari `transaksi` (pemasukan) + `stock_masuk` (pengeluaran), tidak perlu tabel `keuangan` terpisah kecuali dibutuhkan untuk filter yang lebih fleksibel.

## 4. Struktur Halaman (routes)

Sesuai PRD Bagian 3 & 8, bangun 7 halaman ini (gunakan App Router):

```
/                  → Dashboard (ringkasan lintas modul)
/inventaris        → CRUD bahan baku, stock masuk, riwayat harga
/menu              → CRUD menu, resep, HPP & untung otomatis
/transaksi         → Input penjualan (kasir), void transaksi
/keuangan          → Riwayat pemasukan/pengeluaran, filter periode
/tutup-kasir       → Ringkasan harian + riwayat tutup kasir
/laporan           → Laba-Rugi, Menu Terlaris, Menu Paling Untung/Boncos
```

Sidebar navigasi statis berisi 7 item di atas (urutan sama seperti di atas). Di mobile, sidebar collapse jadi hamburger/bottom nav — jangan hilangkan satupun menu saat collapse.

## 5. Desain System (ikuti token ini, jangan improvisasi warna baru)

```
Warna:
  primary        #2563EB   (aksi utama, nav aktif)
  background     #F9FAFB
  card           #FFFFFF   (border #E2E8F0, shadow: 0px 1px 3px rgba(0,0,0,0.05))
  sukses/untung  hijau (bg pastel + teks hijau tua)
  peringatan     kuning (stok menipis)
  bahaya/rugi    merah (kritis, boncos)

Tipografi:
  Inter  → teks umum, heading
  Geist  → angka besar (harga, HPP, omzet, stat card)

Bentuk:
  Card: rounded-xl (12px)
  Button/Input: rounded (8px)
  Badge/Pill: rounded-full
```

Referensi visual lengkap (per halaman) ada di file desain yang sudah di-share sebelumnya — pakai sebagai acuan layout card, bukan untuk disalin 1:1 kalau ada elemen yang di luar scope (lihat Bagian 6).

## 6. Batasan Scope (JANGAN implementasikan dulu)

- Pengeluaran operasional non-bahan baku (listrik, gas, sewa, gaji)
- Integrasi WhatsApp
- Multi-user / role kasir-admin
- App native mobile (Android/iOS store)
- Grafik tren / perbandingan antar periode
- Export/backup data manual

Kalau ada bagian PRD yang terasa butuh salah satu fitur di atas, **tanya dulu**, jangan diam-diam ditambahkan.

## 7. Urutan Kerja yang Disarankan (Roadmap)

1. **Fase 1 (MVP):** Setup project → schema DB → Inventaris → Menu (+ HPP) → Transaksi → Keuangan dasar
2. **Fase 2:** Tutup Kasir Harian → Laporan lengkap
3. **Fase 3 (nanti, jangan dikerjakan dulu):** multi-user/role, pengeluaran non-bahan, grafik tren, export data

## 8. Konvensi Kode

- Bahasa UI: Bahasa Indonesia (label, tombol, pesan error) — konsisten dengan PRD & referensi desain
- Format mata uang: `Rp` + pemisah ribuan titik, contoh `Rp 1.250.000`
- Nama file/komponen: PascalCase untuk komponen React, kebab-case untuk route folder
- Validasi input di server (API route) — jangan andalkan validasi client saja
- Setiap perubahan stok (transaksi, void, stock masuk) harus dalam satu DB transaction agar konsisten

## 9. Referensi

- PRD lengkap: `docs/PRD.md`
- Referensi visual per halaman: sesuai Bagian 8 PRD (Dashboard, Inventaris, Menu, Transaksi, Keuangan, Tutup Kasir, Laporan)