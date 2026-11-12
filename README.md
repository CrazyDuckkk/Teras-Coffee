# Teras Coffee

Aplikasi web untuk operasional kedai kopi, dibuat dengan Next.js, Drizzle ORM, PostgreSQL, dan Better Auth.

## Menjalankan aplikasi secara lokal

1. Pastikan Node.js dan PostgreSQL tersedia. Jika memakai Docker yang sudah dikonfigurasi untuk project ini, jalankan:

   ```bash
   docker compose up -d
   ```

2. Salin `.env.example` menjadi `.env.local`, lalu isi konfigurasi database dan Better Auth. Isi juga `OWNER_EMAIL`, `OWNER_PASSWORD`, dan `OWNER_NAME` untuk akun owner pertama.

3. Pasang dependency:

   ```bash
   npm install
   ```

4. Terapkan migrasi database:

   ```bash
   npm run db:migrate
   ```

   Pastikan `DIRECT_URL` di `.env.local` mengarah ke database lokal atau database pengujian yang memang ingin diubah.

5. Buat akun owner:

   ```bash
   npm run db:seed
   ```

6. Jalankan server development:

   ```bash
   npm run dev
   ```

7. Buka [http://localhost:3000/login](http://localhost:3000/login), lalu masuk dengan email dan password owner dari `.env.local`.

## Peran akun (M1)

- **Owner** memiliki akses penuh, termasuk laporan, keuangan, pengelolaan menu dan inventaris, serta pengelolaan akun kasir melalui **Pengaturan Akun**.
- **Kasir** memiliki akses operasional untuk transaksi, hutang, dan tutup kasir. Menu **Stok Bahan** terlihat di navigasi, tetapi halamannya masih berupa placeholder sampai fitur kasir inventaris dikerjakan. Akses ke halaman/API khusus owner ditolak di server.
- Owner dapat membuat dan menonaktifkan akun kasir. Penonaktifan akun juga mencabut sesi aktif akun tersebut.

## Tutup Kasir dan Laporan

- Tutup kasir menggunakan hitung buta untuk kas fisik dan total QRIS merchant; setelah disimpan, sistem menampilkan kas/QRIS yang diharapkan dan selisihnya.
- Penutupan otomatis berjalan pada jam WIB yang diatur owner (default 23.59), berstatus belum diverifikasi, dan tidak mencatat selisih.
- Penjualan, pembayaran hutang, dan Stock Masuk setelah tutup tetap memakai tanggal WIB hari itu serta ditandai "Setelah tutup".
- Kas awal berikutnya melanjutkan saldo penutupan terakhir beserta arus tunai setelah tutup sampai pergantian hari.
- Tutup kasir hanya dapat disimpan sekali per tanggal WIB; transaksi setelah penutupan tetap diperbolehkan.
- Filter laporan harian memakai hari WIB, mingguan memakai minggu berjalan (Senin–Senin), dan bulanan memakai bulan kalender berjalan.
- Menu terlaris dihitung dari transaksi aktif; void dikecualikan. Laba-rugi mengikuti arus kas yang tercatat pada periode tersebut.

## Fondasi data (M2)

- Aktivitas transaksi, Stock Masuk, dan tutup kasir menyimpan ID pelaku jika tersedia; kolom nullable menjaga catatan lama tetap valid.
- Tabel Pengaturan menyediakan pasangan kunci/nilai beserta waktu dan pelaku perubahan.

## Transaksi kasir (M3)

- Pembayaran mendukung tunai, QRIS, dan hutang; transaksi hutang mewajibkan nama pelanggan.
- Riwayat transaksi menampilkan tujuh hari terakhir dalam tab transaksi sendiri dan kasir lain.
- Respons kasir hanya membawa nilai transaksi dan detail penjualan yang diperlukan, tidak menyertakan HPP.

## Bawa pulang dan kemasan (M4)

- Setiap item transaksi dapat ditandai makan di tempat atau bawa pulang; pilihan bawaan adalah makan di tempat.
- Resep dapat menandai bahan yang hanya dipakai untuk bawa pulang. Pilihan ini memengaruhi stok terpakai dan snapshot HPP transaksi.
- Menu menampilkan HPP dan margin terpisah untuk kedua pilihan. Void mengembalikan stok dari snapshot pemakaian saat penjualan, bukan dari resep yang mungkin sudah berubah.

## Pemeriksaan

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
