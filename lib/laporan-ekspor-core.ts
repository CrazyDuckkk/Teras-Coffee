import ExcelJS from "exceljs";
import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import type { db } from "@/db";
import {
  eksporLaporan,
  hutang,
  hutangPembayaran,
  pengajuanVoid,
  stockMasuk,
  transaksi,
  user,
} from "@/db/schema";
import { formatTanggalWIB, getTodayDateStringWIB } from "@/lib/date";
import type { getLaporanKeuanganCore } from "@/lib/laporan-keuangan-core";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
type DataLaporan = Awaited<ReturnType<typeof getLaporanKeuanganCore>>;

const FORMAT_RUPIAH = '"Rp" #,##0.00;[Red]-"Rp" #,##0.00';
const FORMAT_TANGGAL = "dd mmm yyyy";
const FORMAT_TANGGAL_WAKTU = "dd mmm yyyy hh:mm";

function tambahkanHeader(sheet: ExcelJS.Worksheet, headers: string[]) {
  const row = sheet.addRow(headers);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
  row.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };
}

function tambahkanFooter(sheet: ExcelJS.Worksheet, dibuatPada: Date, range: DataLaporan["range"]) {
  sheet.addRow([]);
  sheet.addRow(["Dibuat pada", dibuatPada]);
  sheet.addRow(["Periode WIB", `${range.tanggalMulai} sampai ${range.tanggalAkhir}`]);
  sheet.getColumn(1).width = Math.max(sheet.getColumn(1).width ?? 0, 20);
}

export function buatWorkbookLaporan(data: DataLaporan, dibuatPada: Date = new Date()) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Teras Coffee";
  workbook.created = dibuatPada;
  workbook.modified = dibuatPada;
  workbook.subject = "Laporan keuangan Teras Coffee";
  workbook.company = "Teras Coffee";

  const ringkasan = workbook.addWorksheet("Ringkasan");
  ringkasan.addRow(["Laporan Keuangan Teras Coffee"]);
  ringkasan.mergeCells("A1:B1");
  ringkasan.getCell("A1").font = { bold: true, size: 16 };
  ringkasan.addRow(["Jenis periode", data.range.periode === "mingguan" ? "Mingguan (Senin–Minggu)" : "Bulanan"]);
  ringkasan.addRow(["Rentang WIB", `${data.range.tanggalMulai} sampai ${data.range.tanggalAkhir}`]);
  ringkasan.addRow([]);
  ringkasan.addRow(["Penjualan tunai", data.ringkasan.penjualanPerMetode.tunai]);
  ringkasan.addRow(["Penjualan QRIS", data.ringkasan.penjualanPerMetode.qris]);
  ringkasan.addRow(["Penjualan hutang", data.ringkasan.penjualanPerMetode.hutang]);
  ringkasan.addRow(["Pelunasan hutang tunai", data.ringkasan.pembayaranHutang.tunai]);
  ringkasan.addRow(["Pelunasan hutang QRIS", data.ringkasan.pembayaranHutang.qris]);

  const harianTerakhir = Math.max(2, data.kasHarian.length + 1);
  ringkasan.addRow(["Laba transaksi lunas", { formula: `SUM(Harian!F2:F${harianTerakhir})` }]);
  ringkasan.addRow(["Biaya susut", { formula: `SUM(Harian!H2:H${harianTerakhir})` }]);
  ringkasan.addRow(["Pengeluaran lain", data.ringkasan.pengeluaranLain]);
  ringkasan.addRow(["Dasar bagi hasil", { formula: "B10-B11-B12" }]);
  ringkasan.addRow(["Persentase bagi hasil", null]);
  ringkasan.addRow(["Nilai bagi hasil", { formula: 'IF(B14="",0,B13*B14)' }]);
  ringkasan.addRow(["Sisa setelah bagi hasil", { formula: "B13-B15" }]);
  ringkasan.addRow(["Uang masuk", data.ringkasan.totalPemasukan]);
  ringkasan.addRow(["Uang keluar", data.ringkasan.totalPengeluaran]);
  ringkasan.addRow(["Piutang akhir periode", data.ringkasan.totalPiutang]);
  ringkasan.addRow(["Selisih kas laci", data.ringkasan.selisihKas]);
  ringkasan.addRow(["Selisih QRIS", data.ringkasan.selisihQris]);
  ringkasan.addRow(["Hari ditutup otomatis", data.ringkasan.hariTutupOtomatis]);
  ringkasan.addRow(["Jumlah transaksi void", data.ringkasan.jumlahVoid]);
  ringkasan.addRow(["Dibuat pada", dibuatPada]);
  ringkasan.addRow(["Definisi periode", "Mingguan berjalan Senin sampai Minggu; bulanan mengikuti kalender. Zona waktu WIB."]);
  ringkasan.getColumn(1).width = 32;
  ringkasan.getColumn(2).width = 64;
  for (const rowNumber of [5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21]) {
    ringkasan.getCell(rowNumber, 2).numFmt = FORMAT_RUPIAH;
  }
  ringkasan.getCell(14, 2).numFmt = "0.00%";
  ringkasan.getCell(14, 2).dataValidation = {
    type: "decimal",
    operator: "between",
    formulae: [0, 1],
    showErrorMessage: true,
    errorTitle: "Persentase tidak valid",
    error: "Masukkan nilai antara 0% dan 100%.",
  };
  ringkasan.getCell(24, 2).numFmt = FORMAT_TANGGAL_WAKTU;

  const harian = workbook.addWorksheet("Harian");
  tambahkanHeader(harian, [
    "Tanggal",
    "Penjualan tunai",
    "Penjualan QRIS",
    "Penjualan hutang",
    "Pelunasan hutang",
    "Laba diakui",
    "Stock Masuk",
    "Susut",
    "Selisih kas",
    "Selisih QRIS",
    "Status tutup",
  ]);
  for (const row of data.kasHarian) {
    harian.addRow([
      new Date(`${row.tanggal}T00:00:00Z`),
      row.penjualanTunai,
      row.penjualanQris,
      row.penjualanHutang,
      row.pembayaranHutang,
      row.labaDiakui,
      row.stockMasuk,
      row.susut,
      row.selisihKas,
      row.selisihQris,
      row.statusTutup,
    ]);
  }
  harian.getColumn(1).numFmt = FORMAT_TANGGAL;
  for (let column = 2; column <= 10; column += 1) harian.getColumn(column).numFmt = FORMAT_RUPIAH;
  tambahkanFooter(harian, dibuatPada, data.range);

  const transaksiSheet = workbook.addWorksheet("Transaksi");
  tambahkanHeader(transaksiSheet, [
    "Tanggal transaksi",
    "Kasir",
    "Metode",
    "Menu",
    "Jumlah porsi",
    "Harga jual",
    "HPP",
    "Bawa pulang",
    "Status",
    "Tanggal lunas",
    "Alasan void",
  ]);
  const labelStatus = { aktif: "Aktif", menunggu_void: "Menunggu void", void: "Void" };
  for (const row of data.transaksi) {
    transaksiSheet.addRow([
      row.tanggal,
      row.namaKasir,
      row.metode.toUpperCase(),
      row.namaMenu,
      row.qty,
      row.hargaJual,
      row.hpp,
      row.bawaPulang ? "Ya" : "Tidak",
      labelStatus[row.status],
      row.tanggalLunas,
      row.alasanVoid,
    ]);
  }
  transaksiSheet.getColumn(1).numFmt = FORMAT_TANGGAL_WAKTU;
  transaksiSheet.getColumn(6).numFmt = FORMAT_RUPIAH;
  transaksiSheet.getColumn(7).numFmt = FORMAT_RUPIAH;
  transaksiSheet.getColumn(10).numFmt = FORMAT_TANGGAL_WAKTU;
  tambahkanFooter(transaksiSheet, dibuatPada, data.range);

  const performa = workbook.addWorksheet("Performa Menu");
  tambahkanHeader(performa, [
    "Menu",
    "Kategori",
    "Porsi makan di tempat",
    "Porsi bawa pulang",
    "Omzet",
    "HPP",
    "Laba",
    "Margin",
  ]);
  for (const row of data.performaMenu) {
    performa.addRow([
      row.nama,
      row.kategori,
      row.porsiDineIn,
      row.porsiBawaPulang,
      row.omzet,
      row.hpp,
      row.laba,
      row.marginPersen / 100,
    ]);
  }
  for (let column = 5; column <= 7; column += 1) performa.getColumn(column).numFmt = FORMAT_RUPIAH;
  performa.getColumn(8).numFmt = "0.00%";
  tambahkanFooter(performa, dibuatPada, data.range);

  const stok = workbook.addWorksheet("Stok dan Susut");
  tambahkanHeader(stok, ["Tanggal", "Jenis", "Rincian", "Perubahan jumlah", "Nilai (Rp)", "Status / alasan", "Pelaku"]);
  for (const row of data.stockDanSusut) {
    stok.addRow([row.tanggal, row.tipe, row.rincian, row.perubahan, row.nilai, row.status, row.pelaku]);
  }
  stok.getColumn(1).numFmt = FORMAT_TANGGAL_WAKTU;
  stok.getColumn(5).numFmt = FORMAT_RUPIAH;
  tambahkanFooter(stok, dibuatPada, data.range);

  const piutang = workbook.addWorksheet("Hutang");
  tambahkanHeader(piutang, ["Nama pelanggan", "Total hutang", "Dibayar sampai akhir periode", "Sisa piutang", "Umur (hari)"]);
  for (const row of data.piutang) {
    piutang.addRow([row.namaPelanggan, row.jumlah, row.dibayar, row.sisa, row.umurHari]);
  }
  for (let column = 2; column <= 4; column += 1) piutang.getColumn(column).numFmt = FORMAT_RUPIAH;
  tambahkanFooter(piutang, dibuatPada, data.range);

  for (const sheet of workbook.worksheets) {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = { ...cell.alignment, vertical: "middle" };
      });
    });
  }

  return workbook;
}

export async function simpanEksporLaporanCore(
  input: {
    periode: "mingguan" | "bulanan";
    rentangMulai: Date;
    rentangSampai: Date;
    namaFile: string;
    dieksporOleh: string;
    dieksporPada?: Date;
  },
  query: DbOrTx,
) {
  const [row] = await query
    .insert(eksporLaporan)
    .values({
      periode: input.periode,
      rentangMulai: input.rentangMulai,
      rentangSampai: input.rentangSampai,
      namaFile: input.namaFile,
      dieksporOleh: input.dieksporOleh,
      dieksporPada: input.dieksporPada,
    })
    .returning();
  return row;
}

export async function listEksporLaporanCore(query: DbOrTx, limit = 10) {
  return query
    .select({
      id: eksporLaporan.id,
      periode: eksporLaporan.periode,
      rentangMulai: eksporLaporan.rentangMulai,
      rentangSampai: eksporLaporan.rentangSampai,
      namaFile: eksporLaporan.namaFile,
      dieksporPada: eksporLaporan.dieksporPada,
      dieksporOlehNama: user.name,
    })
    .from(eksporLaporan)
    .leftJoin(user, eq(user.id, eksporLaporan.dieksporOleh))
    .orderBy(desc(eksporLaporan.dieksporPada))
    .limit(limit);
}

export async function getPeringatanEksporUntukTanggalCore(tanggal: Date[], query: DbOrTx) {
  const validTanggal = [...new Set(tanggal.map((date) => date.toISOString()))].map((date) => new Date(date));
  if (validTanggal.length === 0) return [];

  const rows = await query
    .selectDistinct({
      periode: eksporLaporan.periode,
      rentangMulai: eksporLaporan.rentangMulai,
      rentangSampai: eksporLaporan.rentangSampai,
    })
    .from(eksporLaporan)
    .where(
      or(
        ...validTanggal.map((date) =>
          and(lte(eksporLaporan.rentangMulai, date), gt(eksporLaporan.rentangSampai, date)),
        ),
      ),
    );

  return rows.map((row) => {
    const akhir = new Date(row.rentangSampai.getTime() - 1);
    const periode = row.periode === "mingguan" ? "mingguan" : "bulanan";
    return `Periode ${periode} ${formatTanggalWIB(row.rentangMulai)}–${formatTanggalWIB(akhir)} sudah pernah diekspor; ekspor ulang agar berkas mencerminkan perubahan.`;
  });
}

export async function getTanggalDampakVoidCore(transaksiId: string, query: DbOrTx) {
  const [row] = await query
    .select({ tanggal: transaksi.tanggal, metode: transaksi.metodeBayar })
    .from(transaksi)
    .where(eq(transaksi.id, transaksiId))
    .limit(1);
  if (!row) return [];
  const tanggal = [row.tanggal];
  if (row.metode === "hutang") {
    const pembayaran = await query
      .select({ tanggal: hutangPembayaran.dibayarAt })
      .from(hutangPembayaran)
      .innerJoin(hutang, eq(hutang.id, hutangPembayaran.hutangId))
      .where(and(eq(hutang.transaksiId, transaksiId), isNull(hutangPembayaran.dibatalkanAt)));
    tanggal.push(...pembayaran.map((item) => item.tanggal));
  }
  return tanggal;
}

export async function getTanggalDampakPengajuanVoidCore(pengajuanId: string, query: DbOrTx) {
  const [row] = await query
    .select({ transaksiId: pengajuanVoid.transaksiId })
    .from(pengajuanVoid)
    .where(eq(pengajuanVoid.id, pengajuanId))
    .limit(1);
  return row ? getTanggalDampakVoidCore(row.transaksiId, query) : [];
}

export async function getTanggalDampakPembatalanHutangCore(
  hutangId: string,
  pembayaranId: string,
  query: DbOrTx,
) {
  const [row] = await query
    .select({
      tanggalPembayaran: hutangPembayaran.dibayarAt,
      tanggalLunas: hutang.tanggalLunas,
    })
    .from(hutangPembayaran)
    .innerJoin(hutang, eq(hutang.id, hutangPembayaran.hutangId))
    .where(and(eq(hutangPembayaran.id, pembayaranId), eq(hutangPembayaran.hutangId, hutangId)))
    .limit(1);
  if (!row) return [];

  const pembayaranAktif = await query
    .select({
      id: hutangPembayaran.id,
      tanggal: hutangPembayaran.dibayarAt,
    })
    .from(hutangPembayaran)
    .where(and(eq(hutangPembayaran.hutangId, hutangId), isNull(hutangPembayaran.dibatalkanAt)))
    .orderBy(desc(hutangPembayaran.dibayarAt));
  const tanggalLunasBerikutnya = pembayaranAktif.find((item) => item.id !== pembayaranId)?.tanggal;

  return [
    row.tanggalPembayaran,
    ...(row.tanggalLunas ? [row.tanggalLunas] : []),
    ...(tanggalLunasBerikutnya ? [tanggalLunasBerikutnya] : []),
  ];
}

export async function getTanggalStockMasukCore(id: string, query: DbOrTx) {
  const [row] = await query
    .select({ tanggal: stockMasuk.tanggal })
    .from(stockMasuk)
    .where(eq(stockMasuk.id, id))
    .limit(1);
  return row?.tanggal ?? null;
}

export function labelRentangEkspor(
  range: { periode: "mingguan" | "bulanan"; tanggalMulai: string; tanggalAkhir: string },
) {
  return `${range.periode}-${range.tanggalMulai}-${range.tanggalAkhir}`;
}

export function labelTanggalEkspor(date: Date) {
  return getTodayDateStringWIB(date);
}
