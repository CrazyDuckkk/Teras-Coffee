/**
 * Seed data contoh (bahan baku + harga awal + menu + resep) untuk testing manual
 * M4 ke atas tanpa input manual dari nol. Aman dijalankan di DB kosong; jika
 * bahan_baku sudah ada isinya, script berhenti tanpa mengubah apa pun.
 *
 * Jalankan: npm run db:seed:demo
 */
export {};

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local tidak ada — env var diharapkan sudah diset lewat cara lain
}

async function main() {
  const { db } = await import("../db");
  const { bahanBaku, riwayatHargaBahan, menu, resepMenu } = await import("../db/schema");

  const existing = await db.select({ id: bahanBaku.id }).from(bahanBaku).limit(1);
  if (existing.length > 0) {
    console.log("bahan_baku sudah berisi data — seed demo dilewati (hapus data dulu jika ingin reseed).");
    process.exit(0);
  }

  await db.transaction(async (tx) => {
    async function buatBahan(nama: string, satuan: "gram" | "ml" | "pcs", hargaPerSatuan: string, stokAwal: string, batasMinimum: string) {
      const [row] = await tx
        .insert(bahanBaku)
        .values({ nama, satuan, stokSaatIni: stokAwal, batasMinimumStok: batasMinimum })
        .returning({ id: bahanBaku.id });
      await tx.insert(riwayatHargaBahan).values({ bahanBakuId: row.id, hargaPerSatuan });
      return row.id;
    }

    const kopiBubukId = await buatBahan("Kopi Bubuk Arabika", "gram", "350", "2000", "300");
    const susuId = await buatBahan("Susu UHT Full Cream", "ml", "22", "5000", "1000");
    const gulaId = await buatBahan("Gula Aren Cair", "ml", "45", "3000", "500");
    const esBatuId = await buatBahan("Es Batu", "gram", "5", "10000", "1000");
    const cupId = await buatBahan("Cup Plastik 16oz", "pcs", "1200", "200", "50");
    const rotiId = await buatBahan("Roti Tawar", "pcs", "1500", "40", "10");
    const cokelatId = await buatBahan("Cokelat Bubuk", "gram", "180", "1500", "200");

    async function buatMenu(
      nama: string,
      kategori: string,
      hargaJual: string,
      resep: { bahanBakuId: string; takaran: string }[]
    ) {
      const [row] = await tx.insert(menu).values({ nama, kategori, hargaJual }).returning({ id: menu.id });
      await tx.insert(resepMenu).values(resep.map((r) => ({ menuId: row.id, ...r })));
      return row.id;
    }

    await buatMenu("Es Kopi Susu Gula Aren", "kopi", "18000", [
      { bahanBakuId: kopiBubukId, takaran: "18" },
      { bahanBakuId: susuId, takaran: "120" },
      { bahanBakuId: gulaId, takaran: "30" },
      { bahanBakuId: esBatuId, takaran: "150" },
      { bahanBakuId: cupId, takaran: "1" },
    ]);

    await buatMenu("Kopi Hitam Panas", "kopi", "10000", [
      { bahanBakuId: kopiBubukId, takaran: "15" },
      { bahanBakuId: cupId, takaran: "1" },
    ]);

    await buatMenu("Cokelat Susu Dingin", "non-kopi", "17000", [
      { bahanBakuId: cokelatId, takaran: "25" },
      { bahanBakuId: susuId, takaran: "150" },
      { bahanBakuId: esBatuId, takaran: "150" },
      { bahanBakuId: cupId, takaran: "1" },
    ]);

    await buatMenu("Roti Bakar Cokelat", "snack", "15000", [
      { bahanBakuId: rotiId, takaran: "2" },
      { bahanBakuId: cokelatId, takaran: "20" },
    ]);
  });

  console.log("Seed demo selesai: 7 bahan baku + 4 menu (dengan resep) berhasil dibuat.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed demo gagal:", err);
  process.exit(1);
});
