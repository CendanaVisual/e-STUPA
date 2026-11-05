import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rombelId = searchParams.get("rombelId");
  const selectedAgamaKode = searchParams.get("agamaKode") || "PAH";

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
        pembelajaran: {
          include: { mapel: true },
        },
      },
    }),
    db.sekolah.findFirst(),
    db.semester.findFirst({
      where: { isAktif: true },
      include: { tahunAjaran: true },
    }),
  ]);

  if (!rombel) {
    return NextResponse.json({ error: "Rombel tidak ditemukan" }, { status: 404 });
  }

  const semester = rombel.semester || activeSemester;

  // Urutkan mapel:
  // 1. Agama (kiri PP)
  // 2. PP
  // 3. BIND
  // 4. MTK
  // 5. IPAS
  // 6. PJOK (kiri SB)
  // 7. SB
  // 8. BING
  // 9. MULOK (kanan BING)
  const mapelOrderKeys = ["AGAMA", "PP", "BIND", "MTK", "IPAS", "PJOK", "SB", "BING", "MULOK"];

  const getMapelCategoryKey = (kode: string) => {
    const k = kode.toUpperCase();
    if (k.startsWith("PA") || k === "PAB" || k === "PAH" || k === "PAI" || k === "PAK" || k === "PAKAT" || k === "PABUD") {
      return "AGAMA";
    }
    if (k === "PP") return "PP";
    if (k === "BIND") return "BIND";
    if (k === "MTK") return "MTK";
    if (k === "IPAS") return "IPAS";
    if (k === "PJOK") return "PJOK";
    if (k === "SB") return "SB";
    if (k === "BING") return "BING";
    if (k === "MULOK" || k === "BB") return "MULOK";
    return "OTHER";
  };

  const sortedPembelajaran = [...rombel.pembelajaran].sort((a, b) => {
    const keyA = getMapelCategoryKey(a.mapel.kode);
    const keyB = getMapelCategoryKey(b.mapel.kode);
    const idxA = mapelOrderKeys.indexOf(keyA);
    const idxB = mapelOrderKeys.indexOf(keyB);
    const posA = idxA !== -1 ? idxA : 99;
    const posB = idxB !== -1 ? idxB : 99;
    if (posA !== posB) return posA - posB;
    return a.mapel.nama.localeCompare(b.mapel.nama);
  });

  const pembelajaranIds = sortedPembelajaran.map((p) => p.id);
  const nilaiRaporList =
    pembelajaranIds.length > 0
      ? await db.nilaiRapor.findMany({
          where: { pembelajaranId: { in: pembelajaranIds } },
        })
      : [];

  const nilaiMap = new Map<string, number>();
  nilaiRaporList.forEach((nr) => {
    if (nr.nilaiAkhir !== null) {
      nilaiMap.set(`${nr.siswaId}_${nr.pembelajaranId}`, Number(nr.nilaiAkhir));
    }
  });

  const siswaStats = (rombel.anggota || []).map((agg) => {
    let total = 0;
    let count = 0;
    sortedPembelajaran.forEach((p) => {
      const val = nilaiMap.get(`${agg.siswaId}_${p.id}`);
      if (val !== undefined) {
        total += val;
        count++;
      }
    });
    const avg = count > 0 ? Math.round((total / count) * 10) / 10 : 0;
    return {
      siswaId: agg.siswaId,
      total,
      avg,
    };
  });

  const sortedStats = [...siswaStats].sort((a, b) => b.avg - a.avg);
  const rankMap = new Map<string, number>();
  sortedStats.forEach((s, idx) => {
    rankMap.set(s.siswaId, idx + 1);
  });

  // Hitung rata-rata kelas per mapel
  const colTotals = new Array(sortedPembelajaran.length).fill(0);
  const colCounts = new Array(sortedPembelajaran.length).fill(0);

  const tableRowsHtml = (rombel.anggota || [])
    .map((agg, idx) => {
      const stat = siswaStats.find((s) => s.siswaId === agg.siswaId);
      const rank = rankMap.get(agg.siswaId) || "-";

      const mapelScoresHtml = sortedPembelajaran
        .map((p, pIdx) => {
          const score = nilaiMap.get(`${agg.siswaId}_${p.id}`);
          if (score !== undefined) {
            colTotals[pIdx] += score;
            colCounts[pIdx]++;
            return `<td style="text-align: center; font-weight: 600;">${score}</td>`;
          }
          return `<td style="text-align: center; color: #94a3b8;">-</td>`;
        })
        .join("");

      return `
        <tr>
          <td style="text-align: center;">${agg.noAbsen || idx + 1}</td>
          <td style="text-align: center; font-family: monospace;">${agg.siswa.nisn}</td>
          <td style="text-align: left; font-weight: bold; padding-left: 6px;">${agg.siswa.nama}</td>
          <td style="text-align: center;">${agg.siswa.jenisKelamin}</td>
          ${mapelScoresHtml}
          <td style="text-align: center; font-weight: bold; background-color: #f8fafc;">${stat?.total || 0}</td>
          <td style="text-align: center; font-weight: 800; color: #1e40af; background-color: #eff6ff;">${stat?.avg || 0}</td>
          <td style="text-align: center; font-weight: 800; color: #b45309; background-color: #fffbeb;">#${rank}</td>
        </tr>
      `;
    })
    .join("");

  // Rata-rata kelas row
  let grandTotalAvg = 0;
  let countGrandAvg = 0;
  const colAvgHtml = sortedPembelajaran
    .map((p, pIdx) => {
      const count = colCounts[pIdx];
      const avg = count > 0 ? Math.round((colTotals[pIdx] / count) * 10) / 10 : 0;
      if (count > 0) {
        grandTotalAvg += avg;
        countGrandAvg++;
      }
      return `<td style="text-align: center; font-weight: bold;">${avg || "-"}</td>`;
    })
    .join("");

  const finalAvg = countGrandAvg > 0 ? Math.round((grandTotalAvg / countGrandAvg) * 10) / 10 : 0;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Leger Nilai Kelas ${rombel.nama} - F4 Landscape</title>
  <style>
    @page {
      size: 330mm 215mm landscape; /* Ukuran Standar F4 / Folio Landscape */
      margin: 8mm 12mm 10mm 12mm;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9px;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    .no-print {
      position: fixed;
      top: 12px;
      right: 15px;
      z-index: 100;
      display: flex;
      gap: 8px;
    }
    .btn {
      padding: 7px 15px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 11px;
      cursor: pointer;
      border: none;
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    }
    .btn-print { background: #00bcd4; color: white; }
    .btn-close { background: #64748b; color: white; }
    @media print {
      .no-print { display: none !important; }
      body { margin: 0; }
    }
    .container {
      width: 100%;
      max-width: 310mm;
      margin: 0 auto;
      text-align: center;
    }
    .kop-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 8px;
      text-align: center;
    }
    .kop-header h2 {
      margin: 0 0 2px 0;
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .kop-header h1 {
      margin: 0 0 2px 0;
      font-size: 15px;
      font-weight: 900;
    }
    .kop-header p {
      margin: 0;
      font-size: 9px;
      color: #475569;
    }
    .title-box {
      margin-bottom: 8px;
    }
    .title-box h3 {
      margin: 0 0 2px 0;
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-box {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      font-weight: bold;
      margin-bottom: 8px;
      padding: 0 2px;
    }
    .table-leger {
      width: 100%;
      border-collapse: collapse;
      margin: 0 auto 12px auto;
      font-size: 8.5px;
    }
    .table-leger th, .table-leger td {
      border: 1px solid #cbd5e1;
      padding: 4px 3px;
    }
    .table-leger th {
      background-color: #0f172a;
      color: #ffffff;
      text-transform: uppercase;
      font-size: 8px;
      font-weight: 800;
      vertical-align: middle;
    }
    .table-leger th.kktp-th {
      background-color: #1e293b;
      font-size: 7.5px;
      font-weight: normal;
      color: #94a3b8;
    }
    .table-leger tr.total-row td {
      background-color: #f1f5f9;
      font-weight: bold;
      border-top: 1.5px solid #475569;
    }
    .sign-table {
      width: 100%;
      margin-top: 14px;
      page-break-inside: avoid;
    }
    .sign-table td {
      width: 50%;
      text-align: center;
      vertical-align: top;
      font-size: 9px;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn btn-print" onclick="window.print()">🖨️ Cetak / Simpan PDF (Kertas F4 Landscape)</button>
    <button class="btn btn-close" onclick="window.close()">Tutup</button>
  </div>

  <div class="container">
    <div class="kop-header">
      <h2>PEMERINTAH KOTA DENPASAR • DINAS PENDIDIKAN KEPEMUDAAN DAN OLAHRAGA</h2>
      <h1>${(sekolah?.nama || "SD NEGERI 7 PEDUNGAN").toUpperCase()}</h1>
      <p>${sekolah?.alamat || "Jl. Pulau Moyo No. 63 Pedungan"} • Telp: ${sekolah?.telepon || "(0361) 720123"} • NPSN: ${sekolah?.npsn || "50103069"}</p>
    </div>

    <div class="title-box">
      <h3>LEGER NILAI HASIL BELAJAR (KURIKULUM MERDEKA)</h3>
    </div>

    <div class="meta-box">
      <div>
        <span>Kelas: <strong>${rombel.nama} (Tingkat ${rombel.tingkat})</strong></span> &nbsp;•&nbsp; 
        <span>Wali Kelas: <strong>${rombel.waliKelas?.nama || "Belum Ditentukan"}</strong></span>
      </div>
      <div>
        <span>Tahun Ajaran: <strong>${semester?.tahunAjaran?.nama || "2026/2027"}</strong></span> &nbsp;•&nbsp; 
        <span>Semester: <strong>${semester?.tipe || "GANJIL"}</strong></span> &nbsp;•&nbsp; 
        <span>Ukuran Kertas: <strong>F4 Landscape (Presisi)</strong></span>
      </div>
    </div>

    <table class="table-leger">
      <thead>
        <tr>
          <th rowspan="2" style="width: 24px; text-align: center;">No</th>
          <th rowspan="2" style="width: 70px; text-align: center;">NISN</th>
          <th rowspan="2" style="text-align: left; padding-left: 6px;">Nama Peserta Didik</th>
          <th rowspan="2" style="width: 24px; text-align: center;">L/P</th>
          ${sortedPembelajaran.map((p) => `<th style="text-align: center;">${p.mapel.kode}</th>`).join("")}
          <th rowspan="2" style="width: 42px; text-align: center; background: #1e3a8a;">Total</th>
          <th rowspan="2" style="width: 42px; text-align: center; background: #1e3a8a;">Rata²</th>
          <th rowspan="2" style="width: 35px; text-align: center; background: #78350f;">Rank</th>
        </tr>
        <tr>
          ${sortedPembelajaran.map((p) => `<th class="kktp-th" style="text-align: center;">${p.kktp || 75}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
        <tr class="total-row">
          <td colspan="4" style="text-align: center;">RATA-RATA KELAS</td>
          ${colAvgHtml}
          <td style="text-align: center;">-</td>
          <td style="text-align: center; font-weight: 800; color: #1e40af;">${finalAvg}</td>
          <td style="text-align: center;">-</td>
        </tr>
      </tbody>
    </table>

    <table class="sign-table">
      <tr>
        <td>
          <p style="margin-bottom: 45px;">Mengetahui,<br>Kepala Sekolah</p>
          <p style="font-weight: bold; text-decoration: underline; margin-bottom: 2px;">${sekolah?.namaKepsek || "Drs. I Made Sujana, M.Pd."}</p>
          <p style="margin: 0;">NIP. ${sekolah?.nipKepsek || "196805121992031008"}</p>
        </td>
        <td>
          <p style="margin-bottom: 45px;">${sekolah?.desaKelurahan || "Denpasar"}, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}<br>Wali Kelas</p>
          <p style="font-weight: bold; text-decoration: underline; margin-bottom: 2px;">${rombel.waliKelas?.nama || "Wali Kelas"}</p>
          <p style="margin: 0;">NIP. ${rombel.waliKelas?.nip || "-"}</p>
        </td>
      </tr>
    </table>
  </div>

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
