/** Format angka/string numeric ke "Rp 1.250.000" (tanpa desimal, pemisah ribuan titik). */
export function formatRupiah(value: number | string): string {
  const num = typeof value === "string" ? Number(value) : value;
  const rounded = Math.round(num);
  return `Rp ${rounded.toLocaleString("id-ID")}`;
}

/** Opsi kategori menu yang ditawarkan di form — kategori tetap kolom text bebas di DB. */
export const KATEGORI_OPTIONS = ["kopi", "non-kopi", "snack", "makanan"] as const;

/** Urutkan daftar kategori sesuai urutan tetap KATEGORI_OPTIONS; kategori custom di luar itu ditaruh di akhir (alfabetis). */
export function sortKategoriList(categories: Iterable<string>): string[] {
  const set = new Set(categories);
  const known = KATEGORI_OPTIONS.filter((k) => set.has(k));
  const extra = [...set].filter((k) => !(KATEGORI_OPTIONS as readonly string[]).includes(k)).sort();
  return [...known, ...extra];
}

/** Kategori disimpan trim+lowercase di DB — tampilkan title-case di UI. */
export function formatKategori(kategori: string): string {
  return kategori
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Normalisasi input kategori sebelum disimpan ke DB — dipakai zod transform di lib/validations/menu.ts. */
export function normalizeKategori(kategori: string): string {
  return kategori.trim().toLowerCase().replace(/\s+/g, " ");
}
