# Panduan Pengembangan Teras Coffee

Dokumen ini menggantikan `CLAUDE.md` lama (kini di `docs/Arsip/claude.md`). Acuan fitur dan aturan bisnis ada di
`docs/Spesifikasi Pengembangan Teras Coffee v2.md`; jika dua dokumen bertentangan, spesifikasi v2 yang menang.

## 1. Stack

| Lapisan   | Teknologi                                                                  |
| --------- | -------------------------------------------------------------------------- |
| Framework | Next.js 16 (App Router), React 19, TypeScript                              |
| UI        | Tailwind CSS 4, shadcn/ui; antarmuka berbahasa Indonesia, mobile-first     |
| Backend   | Route Handler di `app/api/*` (satu codebase)                               |
| ORM / DB  | Drizzle ORM (postgres-js), PostgreSQL 16 (dev: Docker, produksi: Supabase) |
| Auth      | Better Auth (email + password, pendaftaran publik mati)                    |
| Validasi  | Zod 4                                                                      |
| Tes       | Vitest 4 dengan database PostgreSQL uji terpisah                           |

Catatan Next.js: versi ini memakai `proxy.ts` (pengganti `middleware.ts`). Dokumentasi resmi yang cocok dengan versi
terpasang ada di `node_modules/next/dist/docs/`; baca itu sebelum memakai API Next.js yang belum familiar.

## 2. Struktur folder

```
app/
  (app)/            halaman yang butuh login: transaksi, hutang, inventaris, menu, keuangan, tutup-kasir, laporan, persetujuan, pengaturan, dashboard
  api/              route handler (transaksi, pengajuan-void, hutang, bahan-baku, stock-masuk, menu, tutup-kasir, pengaturan, auth)
  login/            halaman login
components/
  ui/               komponen shadcn/ui (jangan diubah tanpa alasan)
  layout/           sidebar, navigasi mobile, header; daftar menu di nav-items.ts (per peran)
  shared/           komponen kecil lintas fitur (stat-card, status-badge, currency)
  <fitur>/          komponen per fitur (transaksi, hutang, inventaris, menu, keuangan, laporan, tutup-kasir, dashboard, pengaturan)
db/
  schema/           skema Drizzle, satu berkas per tabel; index.ts mengekspor semuanya
  migrations/       migrasi SQL + meta Drizzle (JANGAN diedit manual; migrasi data memakai `drizzle-kit generate --custom`)
  index.ts          klien database (membaca DATABASE_URL)
lib/
  queries/          fungsi akses data dan logika bisnis per fitur (dipakai halaman dan API); memanggil requireRole()
  *-core.ts         logika uang/aturan bisnis tanpa requireRole() agar bisa diuji ke database (contoh: hutang-core.ts)
  validations/      skema Zod per fitur
  auth.ts           konfigurasi Better Auth
  auth-guard.ts     requireSession(), requireRole() (halaman), requireApiRole() (API)
  roles.ts          daftar peran dan roleCanAccess()
  date.ts           helper zona waktu WIB
  format.ts         format Rupiah dan kategori
scripts/            seed-owner, seed-demo, ganti-password-owner
tests/              global-setup.ts, helpers/, dan berkas *.test.ts
docs/               dokumen ini, spesifikasi v2, PRD lama, arsip/
proxy.ts            redirect ke /login jika tidak ada cookie sesi (hanya UX, bukan pengaman utama)
```

## 3. Konvensi

- **Bahasa:** label, tombol, dan pesan di UI memakai Bahasa Indonesia. Nama tabel dan kolom domain memakai bahasa Indonesia snake_case (`bahan_baku`, `harga_jual`); kolom teknis seperti `is_active` dan `created_at` berbahasa Inggris.
- **Uang:** kolom `numeric(12,2)`. Di JavaScript nilainya berupa **string** ("1500.50"), jangan dicampur dengan `number` tanpa konversi sadar. Untuk perbandingan atau pengurangan, ubah ke sen (`toSen()` di `lib/hutang-core.ts`) agar bebas galat desimal. Tampilan lewat `formatRupiah()` di `lib/format.ts` ("Rp 1.250.000").
- **Waktu:** WIB (Asia/Jakarta), batas hari 00.00. Semua batas hari atau periode lewat helper di `lib/date.ts`, jangan menghitung dari `Date` server (UTC).
- **Soft delete:** nonaktifkan dengan kolom `isActive`, jangan menghapus baris yang sudah dipakai transaksi. Data uang yang dikoreksi (misalnya pembayaran hutang) ditandai batal beserta pelaku dan alasannya, tidak dihapus.
- **Snapshot:** `detail_transaksi` menyimpan `harga_jual_saat_itu` dan `hpp_saat_itu`. Riwayat lama tidak boleh dihitung ulang dari harga terbaru.
- **Transaksi database:** setiap perubahan stok (penjualan, void, stock masuk, penyesuaian) dan setiap perubahan uang (pembayaran hutang) berjalan dalam satu `db.transaction`. Jika beberapa fungsi mengunci baris, urutannya sama: transaksi dulu, baru hutang.
- **Validasi:** dilakukan di server (Zod di route handler). Validasi di klien hanya untuk kenyamanan.
- **Otorisasi:** `proxy.ts` hanya cek cookie. Pengaman sebenarnya ada di server: `requireRole()` di halaman dan query, `requireApiRole()` di setiap route handler (401/403 JSON untuk API). Peran dibaca dari database, bukan dari cookie, sehingga akun yang dinonaktifkan langsung ditolak. Kasir tidak boleh menerima kolom biaya (HPP, harga bahan) dalam respons apa pun.
- **Pelaku:** setiap aksi penting mencatat pelaku (`pelakuId`, nullable agar data lama utuh).
- **Skema:** perubahan selalu lewat migrasi Drizzle (`npm run db:generate`) yang tidak merusak data: kolom baru nullable atau berdefault. Backfill data lama lewat migrasi custom yang aman dijalankan ulang. Cadangkan database sebelum `db:migrate` di produksi.
- **Penamaan:** nama komponen React PascalCase; nama berkas dan folder route kebab-case.

## 4. Menjalankan proyek

```bash
cp .env.example .env.local     # hanya jika .env.local belum ada; PowerShell: Copy-Item .env.example .env.local
npm ci
docker compose up -d           # Postgres dev di port 5432
npm run db:migrate
npm run db:seed                # akun owner dari OWNER_EMAIL / OWNER_PASSWORD
npm run db:seed:demo           # (opsional) data contoh
npm run dev
```

Variabel lingkungan dijelaskan di `.env.example`. Untuk Supabase: `DATABASE_URL` memakai transaction pooler (port 6543),
`DIRECT_URL` memakai session pooler (port 5432) agar `drizzle-kit migrate` tidak menggantung.

## 5. Tes

Tes memakai database PostgreSQL terpisah (service `postgres-test` di `docker-compose.yml`, port 5433, data di RAM).

```bash
npm run db:test:up     # nyalakan database uji, menunggu sampai siap
npm test               # jalankan semua tes
npm run db:test:down   # matikan dan hapus database uji
```

Cara kerjanya:

- `tests/global-setup.ts` menerapkan migrasi Drizzle yang sama ke database uji sebelum tes berjalan.
- `vitest.config.mts` memaksa `DATABASE_URL` ke database uji, apa pun isi `.env.local`.
- Tes menolak berjalan jika nama database tidak berakhiran `_test`.
- Gunakan `kosongkanDatabase()` (`tests/helpers/db.ts`) di `beforeEach` agar tiap tes mulai dari keadaan kosong.
- Berkas tes diberi nama `*.test.ts` di dalam `tests/`. File tes berjalan berurutan karena berbagi satu database.
- Tes yang menyentuh database mengimpor fungsi dari `lib/*-core.ts` (tanpa `requireRole()`), bukan dari `lib/queries/*`, karena `requireRole()` membutuhkan sesi Better Auth dan header Next.js.

Periksa `vitest.config.mts`: pastikan memuat `globalSetup: ["./tests/global-setup.ts"]` dan `env.DATABASE_URL` ke database uji, sesuai penjelasan di atas.

Modul sensitif (uang, peran, void dan persetujuan, pemotongan stok dengan kemasan) wajib punya tes otomatis.

Untuk M7, keputusan harga dilakukan per entri Stock Masuk. Koreksi owner membatalkan entri dengan alasan dan membalik stok/pengeluaran; nilai yang benar dicatat sebagai entri baru. Entri lama tanpa sumber pembayaran tercatat tidak dapat dikoreksi otomatis.

Uji manual M7: sebagai kasir, pastikan halaman Stok Bahan tidak menampilkan harga; catat Stock Masuk dengan kedua pilihan sumber pembayaran; pastikan stok bertambah langsung dan usulan harga berubah menunggu owner. Sebagai owner, setujui/tolak harga, lalu koreksi satu entri dan pastikan stok serta laporan pengeluaran dibalik.

## 6. Cadangan database

Folder `backups/` diabaikan git. Jangan pernah meng-commit isinya.

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmm"

# Dev (Docker)
docker exec teras-coffee-db pg_dump -U teras -d teras_coffee -Fc -f "/tmp/dev-$stamp.dump"
docker cp "teras-coffee-db:/tmp/dev-$stamp.dump" "backups\dev-$stamp.dump"
docker exec teras-coffee-db rm "/tmp/dev-$stamp.dump"

# Produksi (Supabase, lewat Session pooler)
$env:PROD_DB_URL = Read-Host "Session pooler URL produksi"
docker run --rm -e PROD_DB_URL -e STAMP=$stamp -v "${PWD}\backups:/backups" postgres:17-alpine sh -c 'pg_dump "$PROD_DB_URL" -Fc --no-owner --no-privileges -f "/backups/prod-$STAMP.dump"'
Remove-Item Env:PROD_DB_URL

# Periksa isi cadangan (harus menampilkan daftar tabel, bukan error)
docker run --rm -v "${PWD}\backups:/backups" postgres:17-alpine pg_restore --list "/backups/prod-$stamp.dump" | Select-Object -First 15
```

Jangan memakai `>` untuk mengalihkan keluaran `pg_dump` di PowerShell: pengalihan itu merusak berkas biner. Gunakan opsi `-f` seperti di atas.
Jika muncul "server version mismatch", naikkan tag `postgres:17-alpine` ke versi yang sama dengan server.

## 7. Rotasi rahasia

Lakukan **setelah** cadangan produksi berhasil diperiksa. Nilai rahasia tidak boleh dikirim ke chat, issue, atau commit.

| Variabel                                                 | Cara rotasi                                                                                                                                                                                              | Dampak                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Kata sandi database (di `DATABASE_URL` dan `DIRECT_URL`) | Supabase Dashboard, Project Settings, Database, Reset database password. Perbarui kedua URL di Vercel dan `.env.local`. Pakai kata sandi acak yang hanya huruf dan angka agar URL tidak perlu di-encode. | Aplikasi terputus dari database sampai env baru ter-deploy |
| `BETTER_AUTH_SECRET`                                     | Buat nilai baru: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Ganti di Vercel dan `.env.local`.                                                                     | Semua pengguna logout satu kali                            |
| Password login owner (`OWNER_PASSWORD`)                  | Lihat perintah di bawah.                                                                                                                                                                                 | Semua sesi owner dicabut                                   |
| `OWNER_EMAIL`, `BETTER_AUTH_URL`                         | Bukan rahasia, tidak perlu dirotasi.                                                                                                                                                                     | -                                                          |
| Kredensial Docker dev (`teras`/`teras`)                  | Tidak perlu: hanya lokal.                                                                                                                                                                                | -                                                          |

Perubahan env di Vercel hanya berlaku untuk deployment baru, jadi **redeploy** setelah mengubahnya.

Ganti password owner di database produksi (nilai tidak tercatat di riwayat shell):

```powershell
$env:DATABASE_URL = Read-Host "DATABASE_URL produksi (transaction pooler)"
$env:OWNER_PASSWORD_BARU = Read-Host "Password baru owner (min. 12 karakter)"
npm run db:owner:password
Remove-Item Env:DATABASE_URL, Env:OWNER_PASSWORD_BARU
```

Variabel yang sudah diset di terminal menang atas `.env.local`, sehingga skrip menyasar produksi, bukan database dev.

Periksa juga apakah berkas rahasia pernah masuk riwayat git: `git log --all --oneline -- .env .env.local`.
Jika ada hasilnya, berkas itu pernah di-commit; semua nilai di dalamnya wajib dirotasi dan riwayatnya perlu dibersihkan.

## 8. Alur kerja per modul

Pengerjaan mengikuti modul M0 sampai M12 di spesifikasi v2 (bagian 8), satu modul pada satu waktu.

1. Satu cabang git per modul (`m0-persiapan`, `m1-peran-akun`, dan seterusnya).
2. Cadangkan database sebelum menjalankan migrasi.
3. Salin kode, lalu jalankan `npm run typecheck`, `npm run lint`, `npm test`, dan `npm run build`.
4. Uji manual sesuai langkah modul. Laporkan error lengkap jika ada.
5. Setelah lulus: commit, gabungkan ke `master`, lalu mulai modul berikutnya.

Status modul:

| Modul                                  | Status                                      |
| -------------------------------------- | ------------------------------------------- |
| M0 Persiapan dan pengaman              | Lulus                                       |
| M1 Peran, akun, dan logout             | Lulus                                       |
| M2 Jejak pelaku dan fondasi data       | Lulus                                       |
| M3 Transaksi kasir: metode dan riwayat | Lulus                                       |
| M4 Bawa pulang dan kemasan             | Lulus                                       |
| M5 Pengajuan void dan void owner       | Lulus                                       |
| M6 Hutang dan pembayaran sebagian      | Kode dan tes otomatis lulus; menunggu uji manual |
| M7 Stok Bahan dan Stock Masuk           | Kode dan tes otomatis lulus; menunggu uji manual |
| M8 sampai M12                           | Belum dimulai                                   |
