import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buildRekapPresensiWorkbook } from "@/lib/export/rekap-presensi";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rombelId = searchParams.get("rombelId");

  if (!rombelId) {
    return NextResponse.json({ error: "Parameter rombelId wajib diisi" }, { status: 400 });
  }

  try {
    const { buffer, fileName } = await buildRekapPresensiWorkbook(rombelId);
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("[Download Rekap Presensi Excel Error]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat berkas Excel rekap presensi" },
      { status: 500 }
    );
  }
}
