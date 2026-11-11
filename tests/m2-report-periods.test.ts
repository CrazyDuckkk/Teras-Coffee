import { describe, expect, it } from "vitest";
import { getMonthRangeWIB, getWeekRangeWIB } from "@/lib/date";

describe("rentang periode laporan M2", () => {
  it("menghitung minggu berjalan dari Senin dalam WIB, termasuk saat minggu melintasi bulan", () => {
    const range = getWeekRangeWIB(new Date("2026-03-01T16:30:00.000Z"));

    expect(range.start.toISOString()).toBe("2026-02-22T17:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-03-01T17:00:00.000Z");
  });

  it("menghitung bulan kalender berjalan dalam WIB dan menangani Februari tahun kabisat", () => {
    const range = getMonthRangeWIB(new Date("2024-02-29T12:00:00.000Z"));

    expect(range.start.toISOString()).toBe("2024-01-31T17:00:00.000Z");
    expect(range.end.toISOString()).toBe("2024-02-29T17:00:00.000Z");
  });

  it("menentukan bulan berjalan berdasarkan tanggal WIB, bukan tanggal UTC", () => {
    const range = getMonthRangeWIB(new Date("2026-01-31T20:00:00.000Z"));

    expect(range.start.toISOString()).toBe("2026-01-31T17:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-02-28T17:00:00.000Z");
  });
});
