"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Kasir {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date | string;
}

function isKasir(value: unknown): value is Kasir {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    typeof row.email === "string" &&
    typeof row.isActive === "boolean" &&
    (typeof row.createdAt === "string" || row.createdAt instanceof Date)
  );
}

function getErrorMessage(value: unknown, fallback: string) {
  if (
    value &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }
  return fallback;
}

export function KasirPanel({ initialKasir }: { initialKasir: Kasir[] }) {
  const router = useRouter();
  const [kasir, setKasir] = useState(initialKasir);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/pengaturan/kasir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        toast.error(getErrorMessage(result, "Gagal membuat akun kasir"));
        return;
      }

      if (!result || typeof result !== "object" || !("data" in result) || !isKasir(result.data)) {
        toast.error("Respons server tidak valid.");
        return;
      }

      const createdKasir = result.data;
      setKasir((current) => [createdKasir, ...current]);
      setName("");
      setEmail("");
      setPassword("");
      toast.success("Akun kasir berhasil dibuat");
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(row: Kasir) {
    setChangingId(row.id);
    try {
      const response = await fetch(`/api/pengaturan/kasir/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        toast.error(getErrorMessage(result, "Gagal mengubah status akun"));
        return;
      }

      if (!result || typeof result !== "object" || !("data" in result) || !isKasir(result.data)) {
        toast.error("Respons server tidak valid.");
        return;
      }

      const updatedKasir = result.data;
      setKasir((current) =>
        current.map((item) => (item.id === row.id ? updatedKasir : item)),
      );
      toast.success(
        row.isActive
          ? "Akun dinonaktifkan dan semua sesinya dicabut"
          : "Akun kasir diaktifkan kembali",
      );
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setChangingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buat Akun Kasir</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cashier-name">Nama</Label>
              <Input
                id="cashier-name"
                required
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cashier-email">Email</Label>
              <Input
                id="cashier-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cashier-password">Password awal</Label>
              <Input
                id="cashier-password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                Minimal 12 karakter. Berikan password awal ini secara aman kepada kasir.
              </p>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={creating}>
                {creating ? "Membuat..." : "Buat Akun"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Daftar Akun Kasir</h2>
        {kasir.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Belum ada akun kasir.
            </CardContent>
          </Card>
        ) : (
          kasir.map((row) => (
            <Card key={row.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{row.name}</span>
                  <span className="text-sm text-muted-foreground">{row.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={row.isActive ? "secondary" : "outline"}>
                    {row.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                  <Button
                    variant={row.isActive ? "destructive" : "outline"}
                    size="sm"
                    disabled={changingId === row.id}
                    onClick={() => handleStatusChange(row)}
                  >
                    {changingId === row.id
                      ? "Memproses..."
                      : row.isActive
                        ? "Nonaktifkan"
                        : "Aktifkan"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
