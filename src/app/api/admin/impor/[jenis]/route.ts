import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { importSiswa } from "@/lib/import/importer";
import { db } from "@/lib/db";

/** POST multipart/form-data { file, headerRow? } — impor data Dapodik */
export async function POST(req: Request, { params }: { params: Promise<{ jenis: string }> }) {
  const session = await getSession();
  if (session?.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { jenis } = await params;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File wajib diunggah" }, { status: 400 });
  }
  const headerRow = Number(form.get("headerRow") ?? 1);
  const buffer = await file.arrayBuffer();

  switch (jenis) {
    case "siswa": {
      const r = await importSiswa(buffer, headerRow);
      await db.importLog.create({
        data: {
          jenis: "SISWA",
          namaFile: file.name,
          totalBaris: r.totalBaris,
          ditambah: r.ditambah,
          diperbarui: r.diperbarui,
          gagal: r.gagal,
          status: r.gagal === 0 ? "BERHASIL" : r.gagal === r.totalBaris ? "GAGAL" : "SEBAGIAN",
          errors: r.errors,
          createdById: session.userId,
        },
      });
      return NextResponse.json(r);
    }
    // TODO: case "gtk", "rombel", "anggota-rombel", "pembelajaran", "sekolah"
    default:
      return NextResponse.json({ error: `Jenis impor '${jenis}' belum didukung` }, { status: 400 });
  }
}
