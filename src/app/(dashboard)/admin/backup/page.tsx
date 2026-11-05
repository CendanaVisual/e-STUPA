import { db } from "@/lib/db";
import { getSemesterAktif } from "@/lib/services/semester";
import { BackupRestoreClient } from "./backup-restore-client";

export default async function BackupRestorePage() {
  const [semester, backupLogs, arsipCount] = await Promise.all([
    getSemesterAktif(),
    db.backupLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { semester: { include: { tahunAjaran: true } } },
    }),
    db.arsipNilai.count(),
  ]);

  return (
    <BackupRestoreClient
      semester={semester}
      backupLogs={backupLogs}
      arsipCount={arsipCount}
    />
  );
}
