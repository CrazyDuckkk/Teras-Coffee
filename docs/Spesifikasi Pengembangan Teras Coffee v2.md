# Spesifikasi Pengembangan Teras Coffee v2

Disusun 8 November 2026. Status: draft hasil diskusi, siap menjadi acuan pengerjaan per modul.

## 1. Tujuan dan ruang lingkup

Teras Coffee berubah dari aplikasi satu pemilik menjadi aplikasi dua peran: **owner** dan **kasir**.

- Kasir menjalankan operasional harian (transaksi, hutang, stok, tutup kasir) tanpa melihat data biaya.
- Owner, yang jarang berada di kedai, mengawasi dari jauh lewat jejak data, persetujuan, dan pencocokan kas.
- Fitur yang fungsinya tumpang-tindih disatukan, dan laporan mingguan/bulanan bisa diekspor ke Excel.

Basis teknis saat ini: Next.js (App Router), Drizzle ORM, PostgreSQL, Better Auth, Tailwind/shadcn. Antarmuka berbahasa Indonesia dan mobile-first. Hal yang ditunda dan di luar scope ada di bagian 11.

## 2. Peran dan hak akses

**Owner**

- Memiliki semua hak kasir.
- Mengelola menu, resep, bahan baku, dan harga.
- Menyetujui atau menolak pengajuan void dan harga Stock Masuk dari kasir.
- Void langsung, koreksi Stock Masuk, pembatalan pembayaran hutang, dan opname stok.
- Melihat Keuangan, Laporan, dan Kas Harian; mengekspor Excel.
- Mengelola akun kasir dan jam penutupan otomatis.

**Kasir**

- Hanya empat menu: Transaksi, Hutang, Stok Bahan, Tutup Kasir.
- Tidak melihat HPP, harga bahan, Keuangan, Laporan, maupun Dashboard.
- Tidak bisa menghapus atau mem-void transaksi (hanya mengajukan).

**Aturan umum**

- Setiap kasir memakai akun pribadi; setiap aksi penting mencatat pelakunya.
- Peran dicek **di server** (setiap route handler dan query), bukan hanya dengan menyembunyikan menu.
- Ada fitur **logout**.
- Durasi sesi tetap 90 hari untuk saat ini.
- Menonaktifkan akun kasir harus **langsung mencabut semua sesi aktifnya**.
- Owner membuat akun kasir; pendaftaran publik tetap mati.

## 3. Spesifikasi kasir

### 3.1 Navigasi

Transaksi, Hutang, Stok Bahan, Tutup Kasir. Halaman awal kasir adalah Transaksi.

### 3.2 Transaksi

- Input penjualan dengan metode **tunai**, **QRIS**, atau **hutang**.
- Untuk hutang, **nama pelanggan wajib**.
- Setiap item punya pilihan **makan di tempat** (default) atau **bawa pulang**. Ada satu saklar di keranjang ("semua bawa pulang") yang bisa diubah per item.
- Harga jual sama untuk kedua pilihan; yang berbeda hanya HPP (kemasan).
- Riwayat transaksi maksimal **7 hari**, dalam dua tab: **Transaksi saya** dan **Kasir lain**.
- **Ajukan void**: alasan wajib, transaksi berstatus "menunggu void", dan stok tetap terpotong sampai owner menyetujui.
- Tidak ada fitur hapus atau edit transaksi untuk kasir.
- Stok yang tidak cukup (termasuk kemasan) tetap menolak transaksi; stok menipis diberi peringatan lebih awal.
- Respons ke kasir tidak pernah memuat HPP atau data biaya.

### 3.3 Hutang

- Daftar dan detail hutang; hutang dibuat lewat transaksi.
- **Pembayaran sebagian** didukung: setiap pembayaran dicatat sendiri (jumlah, metode tunai atau QRIS, waktu, kasir pelaku).
- Sebelum menyimpan pembayaran, kasir mengonfirmasi nama dan jumlah.
- Sisa dihitung otomatis; hutang lunas saat sisa nol, dan tanggal lunas disimpan.
- Pembatalan pembayaran hanya oleh owner.
- Transaksi hutang yang sudah ada pembayarannya tidak bisa diajukan void lewat alur biasa; penanganannya oleh owner.

### 3.4 Stok Bahan

- Menampilkan bahan aktif, stok, dan status (aman, menipis, kritis). **Harga bahan tidak terlihat.**
- **Stock Masuk dadakan**: pilih bahan yang sudah ada, isi jumlah dan total harga, dan pilih **dibayar dari** (kas laci atau di luar laci).
  - Stok bertambah langsung.
  - Harga baru berstatus **menunggu konfirmasi owner**; selama itu HPP tetap memakai harga lama.
- **Catat Penyesuaian** (langsung berlaku, alasan wajib, pelaku tercatat):
  - tumpah atau gagal dibuat: dipilih per menu (satu porsi), memotong seluruh bahan resepnya;
  - kalibrasi atau tes rasa: dipilih per bahan dengan jumlah (misalnya gram kopi);
  - rusak atau kedaluwarsa: per bahan.
- Kasir tidak bisa membuat, mengubah, atau menonaktifkan bahan, dan tidak bisa melakukan opname.

### 3.5 Tutup Kasir

- Kasir mengisi **kas awal** (terisi otomatis dari hitungan penutupan kemarin).
- **Hitung buta**: kasir memasukkan uang fisik di laci dan total transaksi QRIS dari aplikasi merchant lebih dulu. Setelah disimpan, sistem menampilkan kas yang diharapkan, total QRIS di sistem, selisih masing-masing, dan kolom catatan.
- Kas yang diharapkan = kas awal + penjualan tunai + pembayaran hutang tunai - pembelian yang dibayar dari kas laci.
- QRIS dibandingkan memakai total transaksi bruto, bukan saldo yang sudah cair.
- **Penutupan otomatis** pada jam yang diatur owner (default 23.59, di dalam hari yang sama) jika kasir lupa. Statusnya **"ditutup otomatis, belum diverifikasi"** dan tidak memiliki angka selisih.
- Transaksi setelah tutup tetap masuk hari yang sama dan ditandai "setelah tutup".
- Batas pergantian hari data tetap **00.00 WIB**.

## 4. Spesifikasi owner

### 4.1 Struktur menu

- **Dashboard**
- **Transaksi**: semua transaksi, filter kasir, tanggal, dan status; void langsung.
- **Hutang**: halaman yang sama dengan kasir, dengan aksi tambahan untuk owner.
- **Menu**
- **Bahan Baku** (sisi owner dari Stok Bahan)
- **Keuangan**: tab Ringkasan, Buku Kas, Kas Harian, Laporan.
- **Pengaturan**: akun kasir, jam tutup otomatis, log aktivitas.

Owner dapat melakukan semua yang dapat dilakukan kasir; tidak ada halaman kasir terpisah untuk owner.

### 4.2 Dashboard

- Ringkasan hari ini dan minggu ini.
- Panel **perlu perhatian**: persetujuan menunggu (void dan harga Stock Masuk) dengan jumlah dan umurnya, hari yang ditutup otomatis, selisih kas atau QRIS, stok kritis, dan hutang yang sudah lama.
- Satu daftar menu terlaris singkat (tidak diulang di halaman lain).

### 4.3 Persetujuan dan koreksi

- **Kotak persetujuan** untuk pengajuan void dan harga Stock Masuk; pengajuan yang lewat batas umur ditandai mencolok.
- **Void langsung** oleh owner dengan alasan wajib.
- **Pembatalan pembayaran hutang**.
- **Koreksi Stock Masuk** (sebelumnya belum ada pembatalannya).

### 4.4 Menu

- Resep dengan kondisi tiap bahan: **selalu dipakai** atau **hanya bawa pulang** (untuk kemasan).
- Kemasan diatur per menu; disarankan "paket kemasan" (misalnya gelas, tutup, sedotan) yang dipasang ke banyak menu.
- Halaman Menu menampilkan **dua HPP dan dua margin** (makan di tempat dan bawa pulang).

### 4.5 Bahan Baku

- Data master bahan, harga aktif, dan riwayat harga.
- Konfirmasi harga Stock Masuk dari kasir.
- **Opname** (koreksi hitung fisik): hanya owner, karena dapat menghapus selisih stok.

### 4.6 Pengaturan

- Akun kasir: buat, nonaktifkan (mencabut sesi), dan kelola.
- **Jam penutupan otomatis**: hanya owner yang dapat mengubah, berlaku mulai hari berikutnya, dan perubahan dicatat (siapa dan kapan).
- **Log aktivitas**: daftar yang dibaca dari kolom pelaku, bukan sistem logging terpisah.

### 4.7 Penyederhanaan

- Keuangan, Laporan, dan Tutup Kasir (sisi owner) disatukan di menu Keuangan.
- Menu Terlaris dan Menu Untung/Boncos menjadi satu tabel **Performa Menu**.
- Menu Terlaris dihapus dari Tutup Kasir.
- Satu definisi laba untuk seluruh aplikasi, dengan query bersama untuk layar dan ekspor.
- Tabel dan histori `tutup_kasir` tidak dihapus; penyederhanaan dilakukan di lapisan UI dan query.

## 5. Definisi angka dan aturan bisnis

- **Metode pembayaran**: tunai, QRIS, hutang (tidak ada transfer).
- **HPP** disimpan per item saat transaksi. Kemasan ikut HPP hanya jika item dibawa pulang.
- **Laba transaksi** = harga jual - HPP saat itu, dan **diakui pada tanggal transaksi lunas**. Transaksi tunai dan QRIS lunas di hari itu; hutang diakui saat pelunasan terakhir.
- **Pembayaran sebagian** masuk arus kas pada tanggalnya, tetapi labanya baru diakui saat lunas.
- **Pembelian stok tidak dikurangkan lagi** dari laba karena sudah terbawa lewat HPP.
- **Biaya susut**: dari penyesuaian stok, bernilai harga aktif bahan, ditampilkan sebagai baris tersendiri dan tidak mengubah HPP transaksi penjualan.
- **Dasar bagi hasil** = laba yang sudah lunas pada periode - biaya susut - pengeluaran lain (jika ada). Persentase dan pembagiannya dihitung di Excel; gaji tidak dibebankan ke aplikasi.
- **Arus kas**: uang masuk (tunai, QRIS, pelunasan hutang) dan uang keluar (Stock Masuk dan lainnya).
- **Kas laci dan QRIS** dihitung dan dicocokkan terpisah.
- **Void** dikecualikan dari total; "menunggu void" tetap dihitung normal tetapi ditandai.
- **Hutang belum lunas** adalah piutang dan dilaporkan terpisah.
- Zona waktu WIB; batas hari 00.00.

## 6. Laporan dan ekspor Excel

### Prinsip

- Satu sumber angka: tampilan layar dan file Excel memakai fungsi query yang sama.
- Periode kalender WIB dengan pemilih bulan atau minggu. Minggu berjalan **Senin sampai Minggu**.
- Laporan mingguan dan bulanan berdiri sendiri; bagi hasil hanya dari laporan bulanan.
- Ekspor hanya untuk owner.

### Isi berkas (satu .xlsx, enam sheet)

1. **Ringkasan**: penjualan per metode, laba lunas (dasar), biaya susut, dasar bagi hasil dengan sel persentase dan rumus pembagian, uang masuk dan keluar, piutang belum lunas (baris terpisah), rekap selisih kas laci, selisih QRIS, jumlah hari ditutup otomatis, dan jumlah void.
2. **Harian**: satu baris per hari berisi penjualan per metode, pelunasan hutang, laba lunas, stok masuk, susut, selisih kas, dan status tutup.
3. **Transaksi**: rincian per item (tanggal, kasir, metode, menu, jumlah, harga, HPP, bawa pulang, status, tanggal lunas), termasuk yang void dengan penanda terpisah.
4. **Performa Menu**: porsi (bawa pulang dan makan di tempat), omzet, HPP, laba, margin.
5. **Stok dan Susut**: Stock Masuk (termasuk yang harganya belum dikonfirmasi) dan penyesuaian stok per jenis.
6. **Hutang**: posisi piutang di akhir periode (nama, total, dibayar, sisa, umur hutang).

### Penyajian

- Angka disimpan sebagai angka berformat Rp, tanggal sebagai tanggal sebenarnya.
- Sheet rincian berisi nilai; sheet Ringkasan memakai rumus Excel hidup untuk dasar bagi hasil dan pembagiannya.
- Footer mencatat waktu pembuatan dan definisi periode.

### Peringatan setelah ekspor

- Setiap ekspor dicatat (siapa, kapan, periode).
- Saat owner mem-void atau mengoreksi data pada periode yang sudah pernah diekspor, aplikasi menampilkan peringatan bahwa angka periode itu akan berubah.
- Kunci periode ditunda sampai benar-benar dibutuhkan.

## 7. Keamanan dan data

- Respons dan query untuk kasir dipisahkan dari milik owner sehingga kolom biaya (HPP, harga aktif, riwayat harga) tidak pernah terkirim.
- Kolom pelaku ditambahkan sebagai **nullable** agar data lama tetap utuh.
- Nilai awal untuk data lama: item transaksi lama dianggap makan di tempat, resep lama berkondisi "selalu", metode lama (tunai dan hutang) tetap valid.
- Logika uang, peran, dan persetujuan wajib punya tes otomatis (rumus kas, pengecekan peran, alur void dan persetujuan, pemotongan stok dengan kemasan).
- Berkas `.env.local` ikut terbungkus dalam zip yang diunggah. Jika isinya rahasia sungguhan (kunci Better Auth, kata sandi database), rotasi dan jangan dibagikan lagi.

## 8. Rencana pengerjaan per modul

Urutan sudah mempertimbangkan ketergantungan. Modul berikutnya baru dimulai setelah modul sebelumnya lulus uji.

**M0 Persiapan dan pengaman**

- Cabang git, cadangan database, rotasi rahasia, ringkasan README sebagai pengganti claude.md, dan penyiapan Vitest beserta database uji.
- Selesai jika build bersih dan satu tes contoh berjalan.

**M1 Peran, akun, dan logout**

- Data: kolom peran dan status aktif pada pengguna.
- Kode: `requireRole()`, penjagaan di proxy, layout, dan setiap API route; navigasi menurut peran; Pengaturan > Akun (buat dan nonaktifkan kasir, mencabut sesi); logout.
- Selesai jika kasir ditolak (403) pada halaman dan API owner, dan akun nonaktif langsung keluar.
- Bergantung pada: M0.

**M2 Jejak pelaku dan fondasi data**

- Satu migrasi: kolom pelaku nullable pada tabel transaksi, Stock Masuk, dan Tutup Kasir; tabel pengaturan (kunci dan nilai).
- Selesai jika migrasi lolos pada salinan database dan data lama utuh.
- Bergantung pada: M1.

**M3 Transaksi kasir: metode dan riwayat**

- Metode tunai, QRIS, hutang; nama wajib untuk hutang; riwayat 7 hari dengan dua tab; respons kasir tanpa HPP.
- Bergantung pada: M1, M2.

**M4 Bawa pulang dan kemasan**

- Data: penanda bawa pulang pada item transaksi, kondisi pada resep.
- Kode: pemotongan stok dan snapshot HPP menurut penanda, pengembalian stok saat void yang benar, saklar keranjang, pengaturan kemasan per menu, dua HPP dan dua margin di Menu.
- Tes otomatis wajib: tunggal, campuran, void.
- Bergantung pada: M3.

**M5 Pengajuan void dan void owner**

- Status, alasan, dan pelaku pengajuan; halaman persetujuan sederhana; void langsung oleh owner.
- Bergantung pada: M2, M3.

**M6 Hutang dan pembayaran sebagian**

- Tabel pembayaran hutang, tanggal lunas, konfirmasi kasir, pembatalan oleh owner, aturan void untuk hutang berpembayaran.
- Bergantung pada: M3.

**M7 Stok Bahan kasir dan Stock Masuk**

- Tampilan Stok Bahan tanpa harga, Stock Masuk dengan status harga dan "dibayar dari", konfirmasi harga dan koreksi oleh owner.
- Bergantung pada: M1, M2.

**M8 Penyesuaian stok dan opname**

- Tumpah, kalibrasi, rusak; opname khusus owner; nilai susut.
- Bergantung pada: M7.

**M9 Tutup Kasir v2 dan jam otomatis**

- Kas awal, hitung buta untuk kas dan QRIS, rumus kas yang diharapkan, status penutupan, penanda "setelah tutup", pengaturan jam penutupan otomatis.
- Bergantung pada: M3, M6, M7 (rumus kas) dan tabel pengaturan dari M2.

**M10 Keuangan dan Laporan terpadu**

- Query tunggal (laba diakui saat lunas), tab Ringkasan, Buku Kas, Kas Harian, Laporan, tabel Performa Menu.
- Bergantung pada: M4, M6, M8, M9.

**M11 Ekspor Excel**

- Berkas enam sheet, riwayat ekspor, peringatan void pada periode yang sudah diekspor.
- Bergantung pada: M10.

**M12 Dashboard owner dan log aktivitas**

- Panel "perlu perhatian", penyempurnaan kotak persetujuan, daftar log aktivitas.
- Bergantung pada: M5, M7, M9.

## 9. Cara kerja pengerjaan

Karena claude.md tidak lagi dipakai, aturan kerja berikut menggantikannya.

**Alur per modul**

1. Kamu menyebutkan modul yang dikerjakan dan mengirim **file terbaru** yang saya minta di awal modul (saya tidak melihat project terbarumu, jadi tanpa itu saya bisa menimpa perubahanmu).
2. Saya memberi: daftar file beserta path, isi lengkap untuk file baru atau yang berubah, migrasi Drizzle, langkah uji manual, dan kriteria selesai.
3. Kamu menyalin, menjalankan typecheck, lint, dan build, lalu menguji manual.
4. Kamu melaporkan hasil, termasuk pesan error lengkap bila ada; saya memperbaikinya.
5. Setelah lulus, kamu commit, lalu lanjut ke modul berikutnya.

**Aturan pengaman**

- Satu cabang git per modul; cadangkan database sebelum migrasi.
- Perubahan skema selalu lewat migrasi yang tidak merusak data (kolom nullable atau berdefault).
- Jangan memulai modul berikutnya sebelum modul sebelumnya lulus.
- Modul sensitif (M4, M6, M9, M10) dikerjakan dengan tes otomatis.

**Konteks yang ditempel di awal setiap sesi pengerjaan**

- Aplikasi: Teras Coffee, dua peran (owner dan kasir), spesifikasi v2.
- Stack: Next.js App Router, Drizzle ORM, PostgreSQL, Better Auth, Tailwind/shadcn.
- Konvensi: UI berbahasa Indonesia, zona waktu WIB dengan batas hari 00.00, ikuti tipe uang yang sudah ada di skema, soft delete dengan `isActive`, peran dicek di server dengan `requireRole()`.
- Modul yang sedang dikerjakan dan modul yang sudah lulus.

## 10. Asumsi dan butir terbuka

**Asumsi (koreksi bila tidak sesuai)**

- Minggu laporan Senin sampai Minggu.
- Enam sheet ekspor sesuai bagian 6; rumus bagi hasil hidup di sheet Ringkasan.
- Halaman awal kasir adalah Transaksi.
- Transaksi hutang yang sudah ada pembayarannya hanya bisa di-void oleh owner.
- Nama menu owner untuk Inventaris adalah "Bahan Baku" (kasir: "Stok Bahan").

**Butir terbuka**

- Cara memindahkan data hutang lunas lama ke model pembayaran bertahap (misalnya satu pembayaran penuh pada tanggal lunas).
- Batas umur pengajuan persetujuan sebelum ditandai mencolok.
- Ambang "menipis" untuk kemasan dan bahan lain.
- Apakah perlu pencatatan sederhana untuk pengeluaran lain di luar bahan baku.
- Apakah konfirmasi harga Stock Masuk dilakukan per item atau sekaligus.
- Jumlah bahan dan menu yang perlu diatur kemasannya saat M4 (menentukan perlu tidaknya paket kemasan).

## 11. Ditunda dan di luar scope

- Gaji dan bagi hasil di dalam aplikasi (dihitung di Excel).
- Biaya operasional rinci (sewa, listrik) karena saat ini tidak ada.
- Kunci periode laporan.
- Transfer bank sebagai metode pembayaran (hanya QRIS).
- Notifikasi push atau WhatsApp, diskon dan promo, manajemen supplier, multi-cabang, prakiraan penjualan.
