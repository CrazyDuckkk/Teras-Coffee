/** Format angka/string numeric ke "Rp 1.250.000" (tanpa desimal, pemisah ribuan titik). */
export function formatRupiah(value: number | string): string {
  const num = typeof value === "string" ? Number(value) : value;
  const rounded = Math.round(num);
  return `Rp ${rounded.toLocaleString("id-ID")}`;
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
