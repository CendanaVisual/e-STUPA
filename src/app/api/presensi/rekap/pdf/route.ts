import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { renderSignatureCellHtml } from "@/lib/export/signature-helper";

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

  const [rombel, sekolah, activeSemester] = await Promise.all([
    db.rombel.findUnique({
      where: { id: rombelId },
      include: {
        waliKelas: true,
        semester: { include: { tahunAjaran: true } },
        anggota: {
          include: { siswa: true },
          orderBy: [{ noAbsen: "asc" }, { siswa: { nama: "asc" } }],
        },
      },
    }),
    db.sekolah.findFirst({ orderBy: { updatedAt: "desc" } }),
    db.semester.findFirst({
      where: { isAktif: true },
      include: { tahunAjaran: true },
    }),
  ]);

  if (!rombel) {
    return NextResponse.json({ error: "Rombel tidak ditemukan" }, { status: 404 });
  }

  const semester = rombel.semester || activeSemester;

  const presensiRecords = await db.presensi.findMany({
    where: {
      rombelId: rombel.id,
      semesterId: semester?.id,
    },
  });

  const siswaStats = new Map<
    string,
    { hadir: number; sakit: number; izin: number; alpa: number }
  >();

  for (const agg of rombel.anggota) {
    siswaStats.set(agg.siswaId, { hadir: 0, sakit: 0, izin: 0, alpa: 0 });
  }

  for (const p of presensiRecords) {
    const stats = siswaStats.get(p.siswaId);
    if (stats) {
      if (p.status === "HADIR") stats.hadir++;
      else if (p.status === "SAKIT") stats.sakit++;
      else if (p.status === "IZIN") stats.izin++;
      else if (p.status === "ALPA") stats.alpa++;
    }
  }

  let totalH = 0;
  let totalS = 0;
  let totalI = 0;
  let totalA = 0;

  const rowsHtml = rombel.anggota
    .map((agg, idx) => {
      const stats = siswaStats.get(agg.siswaId) || { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
      const totalHari = stats.hadir + stats.sakit + stats.izin + stats.alpa;
      const persen = totalHari > 0 ? Math.round((stats.hadir / totalHari) * 100) : 100;

      totalH += stats.hadir;
      totalS += stats.sakit;
      totalI += stats.izin;
      totalA += stats.alpa;

      return `
        <tr>
          <td style="text-align: center;">${agg.noAbsen || idx + 1}</td>
          <td style="text-align: center; font-family: monospace;">${agg.siswa.nisn}</td>
          <td style="font-weight: 600;">${agg.siswa.nama}</td>
          <td style="text-align: center;">${agg.siswa.jenisKelamin}</td>
          <td style="text-align: center; color: #059669; font-weight: bold;">${stats.hadir}</td>
          <td style="text-align: center; color: #d97706; font-weight: bold;">${stats.sakit}</td>
          <td style="text-align: center; color: #0284c7; font-weight: bold;">${stats.izin}</td>
          <td style="text-align: center; color: #e11d48; font-weight: bold;">${stats.alpa}</td>
          <td style="text-align: center; font-weight: bold;">${totalHari}</td>
          <td style="text-align: center; font-weight: bold;">${persen}%</td>
        </tr>
      `;
    })
    .join("");

  const totalPertemuanSemua = totalH + totalS + totalI + totalA;
  const persenTotal =
    totalPertemuanSemua > 0 ? Math.round((totalH / totalPertemuanSemua) * 100) : 100;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Rekap Presensi Siswa - Kelas ${rombel.nama}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm 15mm 15mm;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      color: #1e293b;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    .no-print {
      position: fixed;
      top: 15px;
      right: 15px;
      z-index: 100;
      display: flex;
      gap: 10px;
    }
    .btn {
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: bold;
      font-size: 12px;
      cursor: pointer;
      border: none;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .btn-print { background: #00bcd4; color: white; }
    .btn-close { background: #64748b; color: white; }
    @media print {
      .no-print { display: none !important; }
      body { margin: 0; }
    }
    .kop-sekolah {
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
      text-align: center;
    }
    .kop-sekolah h2 {
      margin: 0 0 2px 0;
      font-size: 12px;
      font-weight: normal;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .kop-sekolah h1 {
      margin: 0 0 4px 0;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .kop-sekolah p {
      margin: 0;
      font-size: 10px;
      color: #475569;
    }
    .title-box {
      text-align: center;
      margin-bottom: 14px;
    }
    .title-box h3 {
      margin: 0 0 4px 0;
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .title-box p {
      margin: 0;
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
    }
    .meta-table {
      width: 100%;
      margin-bottom: 12px;
      font-size: 10px;
    }
    .meta-table td {
      padding: 2px 0;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 10px;
    }
    .data-table th, .data-table td {
      border: 1px solid #cbd5e1;
      padding: 5px 6px;
    }
    .data-table th {
      background-color: #0f172a;
      color: #ffffff;
      text-transform: uppercase;
      font-size: 9px;
      font-weight: 800;
    }
    .data-table tr.total-row td {
      background-color: #f1f5f9;
      font-weight: bold;
      border-top: 2px solid #64748b;
    }
    .sign-table {
      width: 100%;
      margin-top: 25px;
      page-break-inside: avoid;
    }
    .sign-table td {
      width: 50%;
      text-align: center;
      vertical-align: top;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn btn-print" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
    <button class="btn btn-close" onclick="window.close()">Tutup</button>
  </div>

  <div class="kop-sekolah">
    <h2>PEMERINTAH KOTA DENPASAR • DINAS PENDIDIKAN KEPEMUDAAN DAN OLAHRAGA</h2>
    <h1>${(sekolah?.nama || "SD NEGERI 7 PEDUNGAN").toUpperCase()}</h1>
    <p>${sekolah?.alamat || "Jl. Pulau Moyo No. 63 Pedungan"}${sekolah?.telepon ? ` • Telp: ${sekolah.telepon}` : ""} • Email: ${sekolah?.email || "sdn7pedungan63@gmail.com"}</p>
    <p>NPSN: ${sekolah?.npsn || "50103069"} • Kode Pos: ${sekolah?.kodePos || "80222"}</p>
  </div>

  <div class="title-box">
    <h3>REKAPITULASI PRESENSI / KEHADIRAN SISWA</h3>
    <p>Tahun Ajaran ${semester?.tahunAjaran?.nama || "2026/2027"} • Semester ${semester?.tipe || "Ganjil"}</p>
  </div>

  <table class="meta-table">
    <tr>
      <td style="width: 15%; font-weight: bold;">Kelas</td>
      <td style="width: 35%;">: Kelas ${rombel.nama} (Tingkat ${rombel.tingkat})</td>
      <td style="width: 20%; font-weight: bold; text-align: right;">Total Peserta Didik :</td>
      <td style="width: 30%; font-weight: bold;">${rombel.anggota.length} Siswa</td>
    </tr>
    <tr>
      <td style="font-weight: bold;">Wali Kelas</td>
      <td>: ${rombel.waliKelas?.nama || "Belum Ditentukan"}</td>
      <td style="font-weight: bold; text-align: right;">Tanggal Cetak :</td>
      <td>${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</td>
    </tr>
  </table>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 28px; text-align: center;">No</th>
        <th style="width: 80px; text-align: center;">NISN</th>
        <th>Nama Peserta Didik</th>
        <th style="width: 35px; text-align: center;">L/P</th>
        <th style="width: 50px; text-align: center;">Hadir</th>
        <th style="width: 50px; text-align: center;">Sakit</th>
        <th style="width: 50px; text-align: center;">Izin</th>
        <th style="width: 50px; text-align: center;">Alpa</th>
        <th style="width: 65px; text-align: center;">Total Hari</th>
        <th style="width: 70px; text-align: center;">% Hadir</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr class="total-row">
        <td colspan="4" style="text-align: center;">TOTAL KELAS</td>
        <td style="text-align: center; color: #059669;">${totalH}</td>
        <td style="text-align: center; color: #d97706;">${totalS}</td>
        <td style="text-align: center; color: #0284c7;">${totalI}</td>
        <td style="text-align: center; color: #e11d48;">${totalA}</td>
        <td style="text-align: center;">${totalPertemuanSemua}</td>
        <td style="text-align: center;">${persenTotal}%</td>
      </tr>
    </tbody>
  </table>

  <table class="sign-table">
    <tr>
      <td>
        ${renderSignatureCellHtml({
          topLinesHtml: "Mengetahui,<br>Kepala Sekolah",
          signatureUrl: sekolah?.capTtdKepsekUrl,
          signerName: sekolah?.namaKepsek || "-",
          signerNip: sekolah?.nipKepsek || "-",
          isCapKepsek: true,
          spaceHeightPx: 58,
        })}
      </td>
      <td>
        ${renderSignatureCellHtml({
          topLinesHtml: `${sekolah?.desaKelurahan || "Denpasar"}, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}<br>Wali Kelas`,
          signatureUrl: rombel.waliKelas?.ttdUrl,
          signerName: rombel.waliKelas?.nama || "Wali Kelas",
          signerNip: rombel.waliKelas?.nip,
          spaceHeightPx: 58,
        })}
      </td>
    </tr>
  </table>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 500);
    });
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
