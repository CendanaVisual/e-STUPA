import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const username = process.env.SEED_SUPERADMIN_USERNAME ?? "superadmin";
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error("SEED_SUPERADMIN_PASSWORD wajib diisi (min. 8 karakter)");
  }

  await db.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      passwordHash: await bcrypt.hash(password, 12),
      role: "SUPERADMIN",
    },
  });

  // Tahun ajaran & semester awal: 2026/2027 Ganjil
  const ta = await db.tahunAjaran.upsert({
    where: { nama: "2026/2027" },
    update: {},
    create: { nama: "2026/2027", tahunMulai: 2026, isAktif: true },
  });
  await db.semester.upsert({
    where: { kode: "20261" },
    update: {},
    create: {
      tahunAjaranId: ta.id,
      tipe: "GANJIL",
      kode: "20261",
      status: "AKTIF",
      isAktif: true,
    },
  });
  await db.semester.upsert({
    where: { kode: "20262" },
    update: {},
    create: { tahunAjaranId: ta.id, tipe: "GENAP", kode: "20262", status: "DRAFT" },
  });

  console.log(`Seed selesai. Superadmin: ${username}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
