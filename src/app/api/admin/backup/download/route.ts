import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { backupSemesterFull, backupPerMenu } from "@/server/actions/backup";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "full"; // "full" or "menu"
  const menuKey = searchParams.get("menuKey");

  if (type === "menu" && menuKey) {
    const res = await backupPerMenu(menuKey);
    if (!res.success) {
      return NextResponse.json({ error: res.message }, { status: 400 });
    }
    const filename = `backup-eSTUPA-modul-${menuKey.toLowerCase()}-${Date.now()}.json`;
    return new NextResponse(JSON.stringify(res.data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const res = await backupSemesterFull();
  if (!res.success) {
    return NextResponse.json({ error: res.message }, { status: 400 });
  }
  const filename = `backup-eSTUPA-semester-${Date.now()}.json`;
  return new NextResponse(JSON.stringify(res.data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
