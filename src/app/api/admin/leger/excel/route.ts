import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buildLegerWorkbook } from "@/lib/export/leger-excel";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rombelId = searchParams.get("rombelId");
  const agamaKode = searchParams.get("agamaKode") || "PAH";

  if (!rombelId) {
    return NextResponse.json({ error: "Parameter rombelId wajib diisi" }, { status: 400 });
  }

  try {
    const { buffer, fileName } = await buildLegerWorkbook(rombelId, agamaKode);
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("[Download Leger Excel Error]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat berkas Excel Leger" },
      { status: 500 }
    );
  }
}
