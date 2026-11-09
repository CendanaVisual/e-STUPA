import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertPembelajaranAccess } from "@/lib/auth/rbac";
import { buildLembarPenilaianTemplateWorkbook } from "@/lib/export/lembar-penilaian-template";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pembelajaranId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pembelajaranId } = await params;
  try {
    await assertPembelajaranAccess(session, pembelajaranId);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 403 }
    );
  }

  try {
    const { buffer, fileName } =
      await buildLembarPenilaianTemplateWorkbook(pembelajaranId);
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Gagal membuat template lembar penilaian siswa.",
      },
      { status: 500 }
    );
  }
}
