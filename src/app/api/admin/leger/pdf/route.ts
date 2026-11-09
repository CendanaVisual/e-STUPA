import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  buildDeskripsiCapaianTp,
  resolveTpDeskripsiText,
  type TpScoreEntry,
} from "@/lib/grading/calc";
import { renderSignatureCellHtml } from "@/lib/export/signature-helper";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rombelId = searchParams.get("rombelId");
  const mode = searchParams.get("mode");
  const pembelajaranId = searchParams.get("pembelajaranId");

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
          include: { mapel: true, gtk: true },
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

  // ===========================================================================
  // MODE GURU MAPEL: No | NISN | Nama Peserta Didik | L/P | Nilai | Rank | Deskripsi
  // ===========================================================================
  if (mode === "mapel" && pembelajaranId) {
    const targetP = rombel.pembelajaran.find((p) => p.id === pembelajaranId);
    if (!targetP) {
      return NextResponse.json({ error: "Pembelajaran tidak ditemukan" }, { status: 404 });
    }

    const [nilaiRaporList, pCols, masterTps] = await Promise.all([
      db.nilaiRapor.findMany({
        where: { pembelajaranId: targetP.id },
      }),
      db.penilaian.findMany({
        where: { pembelajaranId: targetP.id, kategori: "HARIAN" },
        include: { nilai: true },
        orderBy: { urutan: "asc" },
      }),
      semester
        ? db.tujuanPembelajaran.findMany({
            where: {
              semesterId: semester.id,
              tingkat: rombel.tingkat,
              mapelId: targetP.mapelId,
            },
            orderBy: [{ urutan: "asc" }, { kodeTp: "asc" }],
          })
        : Promise.resolve([]),
    ]);

    const kktp = targetP.kktp ?? 75;
    const nilaiMap = new Map<string, number>();
    const deskripsiMap = new Map<string, string>();

    nilaiRaporList.forEach((nr) => {
      if (nr.nilaiAkhir !== null) {
        nilaiMap.set(nr.siswaId, Math.round(Number(nr.nilaiAkhir)));
      }
      const savedDesc = [nr.capaianTertinggi, nr.capaianTerendah]
        .filter((s): s is string => Boolean(s && s.trim()))
        .join(" ");
      if (savedDesc) {
        deskripsiMap.set(nr.siswaId, savedDesc);
      }
    });

    for (const agg of rombel.anggota) {
      if (deskripsiMap.has(agg.siswaId)) continue;
      const entries: TpScoreEntry[] = [];
      for (const col of pCols) {
        const n = col.nilai.find((item) => item.siswaId === agg.siswaId);
        if (n && n.nilai !== null) {
          entries.push({
            kode: col.nama,
            deskripsi: resolveTpDeskripsiText(col, masterTps),
            nilai: Number(n.nilai),
          });
        }
      }
      if (entries.length > 0) {
        const built = buildDeskripsiCapaianTp(entries, kktp);
        if (built.deskripsiGabungan) {
          deskripsiMap.set(agg.siswaId, built.deskripsiGabungan);
        }
      }
    }

    const scoredStudents = rombel.anggota
      .map((agg) => ({ siswaId: agg.siswaId, score: nilaiMap.get(agg.siswaId) }))
      .filter((x): x is { siswaId: string; score: number } => x.score !== undefined)
      .sort((a, b) => b.score - a.score);

    const rankMap = new Map<string, number>();
    scoredStudents.forEach((item, idx) => {
      if (idx > 0 && item.score === scoredStudents[idx - 1].score) {
        rankMap.set(item.siswaId, rankMap.get(scoredStudents[idx - 1].siswaId) ?? idx + 1);
      } else {
        rankMap.set(item.siswaId, idx + 1);
      }
    });

    const rowsHtml = rombel.anggota
      .map((agg, idx) => {
        const score = nilaiMap.get(agg.siswaId);
        const rank = rankMap.get(agg.siswaId);
        const desc = deskripsiMap.get(agg.siswaId) || "-";
        return `
          <tr>
            <td style="text-align: center;">${agg.noAbsen || idx + 1}</td>
            <td style="text-align: center; font-family: monospace;">${agg.siswa.nisn}</td>
            <td style="text-align: left; font-weight: bold; padding-left: 6px;">${agg.siswa.nama}</td>
            <td style="text-align: center;">${agg.siswa.jenisKelamin}</td>
            <td style="text-align: center; font-weight: 800; color: #1e40af; background-color: #eff6ff;">${score !== undefined ? score : "-"}</td>
            <td style="text-align: center; font-weight: 800; color: #b45309; background-color: #fffbeb;">${rank !== undefined ? `#${rank}` : "-"}</td>
            <td style="text-align: left; padding: 4px 6px; line-height: 1.35;">${desc}</td>
          </tr>
        `;
      })
      .join("");

    const htmlMapel = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Leger Nilai ${targetP.mapel.nama} - Kelas ${rombel.nama}</title>
  <style>
    @page { size: 330mm 215mm landscape; margin: 8mm 12mm 10mm 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #0f172a; background: #fff; margin: 0; padding: 0; }
    .no-print { position: fixed; top: 12px; right: 15px; z-index: 100; display: flex; gap: 8px; }
    .btn { padding: 7px 15px; border-radius: 6px; font-weight: bold; font-size: 11px; cursor: pointer; border: none; box-shadow: 0 2px 4px rgba(0,0,0,0.15); }
    .btn-print { background: #00bcd4; color: white; }
    .btn-close { background: #64748b; color: white; }
    @media print { .no-print { display: none !important; } body { margin: 0; } }
    .container { width: 100%; max-width: 310mm; margin: 0 auto; text-align: center; }
    .kop-header { border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 8px; text-align: center; }
    .kop-header h2 { margin: 0 0 2px 0; font-size: 11px; font-weight: bold; text-transform: uppercase; }
    .kop-header h1 { margin: 0 0 2px 0; font-size: 15px; font-weight: 900; }
    .kop-header p { margin: 0; font-size: 9px; color: #475569; }
    .title-box { margin-bottom: 8px; }
    .title-box h3 { margin: 0; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .meta-box { display: flex; justify-content: space-between; font-size: 9px; font-weight: bold; margin-bottom: 8px; }
    .table-leger { width: 100%; border-collapse: collapse; margin: 0 auto 12px auto; font-size: 9px; }
    .table-leger th, .table-leger td { border: 1px solid #cbd5e1; padding: 5px 4px; }
    .table-leger th { background-color: #0f172a; color: #ffffff; text-transform: uppercase; font-size: 8.5px; font-weight: 800; }
    .sign-table { width: 100%; margin-top: 14px; page-break-inside: avoid; }
    .sign-table td { width: 50%; text-align: center; vertical-align: top; font-size: 9px; }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn btn-print" onclick="window.print()">🖨️ Cetak / Simpan PDF (F4 Landscape)</button>
    <button class="btn btn-close" onclick="window.close()">Tutup</button>
  </div>
  <div class="container">
    <div class="kop-header">
      <h2>PEMERINTAH KOTA DENPASAR • DINAS PENDIDIKAN KEPEMUDAAN DAN OLAHRAGA</h2>
      <h1>${(sekolah?.nama || "SD NEGERI 7 PEDUNGAN").toUpperCase()}</h1>
      <p>${sekolah?.alamat || "Jl. Pulau Moyo No. 63 Pedungan"} • NPSN: ${sekolah?.npsn || "50103069"}</p>
    </div>
    <div class="title-box">
      <h3>LEGER NILAI MATA PELAJARAN ${targetP.mapel.nama.toUpperCase()} (${targetP.mapel.kode})</h3>
    </div>
    <div class="meta-box">
      <div>
        <span>Kelas: <strong>${rombel.nama} (Tingkat ${rombel.tingkat})</strong></span> &nbsp;•&nbsp;
        <span>Guru Mapel: <strong>${targetP.gtk?.nama || "-"}</strong></span> &nbsp;•&nbsp;
        <span>KKTP: <strong>${kktp}</strong></span>
      </div>
      <div>
        <span>Tahun Ajaran: <strong>${semester?.tahunAjaran?.nama || "2026/2027"} (${semester?.tipe || "GANJIL"})</strong></span>
      </div>
    </div>
    <table class="table-leger">
      <thead>
        <tr>
          <th style="width: 28px; text-align: center;">No</th>
          <th style="width: 75px; text-align: center;">NISN</th>
          <th style="width: 190px; text-align: left; padding-left: 6px;">Nama Peserta Didik</th>
          <th style="width: 28px; text-align: center;">L/P</th>
          <th style="width: 70px; text-align: center; background: #1e3a8a;">Nilai (Nilai Akhir)</th>
          <th style="width: 45px; text-align: center; background: #78350f;">Rank</th>
          <th style="text-align: left; padding-left: 6px;">Deskripsi (TP Tercapai &amp; TP Perlu Bimbingan)</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    <table class="sign-table">
      <tr>
        <td>
          ${renderSignatureCellHtml({
            topLinesHtml: "Mengetahui,<br>Kepala Sekolah",
            signatureUrl: sekolah?.capTtdKepsekUrl,
            signerName: sekolah?.namaKepsek || "-",
            signerNip: sekolah?.nipKepsek,
            isCapKepsek: true,
            spaceHeightPx: 52,
          })}
        </td>
        <td>
          ${renderSignatureCellHtml({
            topLinesHtml: `${sekolah?.desaKelurahan || "Denpasar"}, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}<br>Guru Mata Pelajaran`,
            signatureUrl: targetP.gtk?.ttdUrl,
            signerName: targetP.gtk?.nama || "Guru Mata Pelajaran",
            signerNip: targetP.gtk?.nip,
            spaceHeightPx: 52,
          })}
        </td>
      </tr>
    </table>
  </div>
  <script>
    window.addEventListener('load', () => { setTimeout(() => { window.print(); }, 500); });
  </script>
</body>
</html>`;

    return new NextResponse(htmlMapel, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // ===========================================================================
  // MODE LEGER LENGKAP (MATRIKS SELURUH MAPEL)
  // ===========================================================================
  const mapelOrderKeys = ["AGAMA", "PP", "BIND", "MTK", "IPAS", "PJOK", "SB", "BING", "MULOK"];

  const getMapelCategoryKey = (kode: string, nama: string = "") => {
    const k = kode.toUpperCase().trim();
    const nm = nama.toLowerCase();
    if (
      k.startsWith("PA") ||
      k === "PAB" ||
      k === "PAH" ||
      k === "PAI" ||
      k === "PAK" ||
      k === "PAKAT" ||
      k === "PABUD" ||
      nm.includes("agama")
    ) {
      return "AGAMA";
    }
    if (k === "PP") return "PP";
    if (k === "BIND") return "BIND";
    if (k === "MTK") return "MTK";
    if (k === "IPAS") return "IPAS";
    if (k === "PJOK" || nm.includes("jasmani")) return "PJOK";
    if (k === "SB") return "SB";
    if (k === "BING") return "BING";
    if (k === "MULOK" || k === "BB" || nm.includes("bahasa bali") || nm.includes("muatan lokal")) {
      return "MULOK";
    }
    return "OTHER";
  };

  const sortedPembelajaran = [...rombel.pembelajaran].sort((a, b) => {
    const keyA = getMapelCategoryKey(a.mapel.kode, a.mapel.nama);
    const keyB = getMapelCategoryKey(b.mapel.kode, b.mapel.nama);
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
      nilaiMap.set(`${nr.siswaId}_${nr.pembelajaranId}`, Math.round(Number(nr.nilaiAkhir)));
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
    const avg = count > 0 ? Math.round((total / count) * 10) / 10 : null;
    return {
      siswaId: agg.siswaId,
      total: count > 0 ? Math.round(total * 10) / 10 : null,
      avg,
    };
  });

  const sortedStats = siswaStats
    .filter((s): s is { siswaId: string; total: number; avg: number } => s.avg !== null)
    .sort((a, b) => b.avg - a.avg);
  const rankMap = new Map<string, number>();
  sortedStats.forEach((s, idx) => {
    if (idx > 0 && s.avg === sortedStats[idx - 1].avg) {
      rankMap.set(s.siswaId, rankMap.get(sortedStats[idx - 1].siswaId) ?? idx + 1);
    } else {
      rankMap.set(s.siswaId, idx + 1);
    }
  });

  const colTotals = new Array(sortedPembelajaran.length).fill(0);
  const colCounts = new Array(sortedPembelajaran.length).fill(0);

  const tableRowsHtml = (rombel.anggota || [])
    .map((agg, idx) => {
      const stat = siswaStats.find((s) => s.siswaId === agg.siswaId);
      const rank = rankMap.get(agg.siswaId);

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
          <td style="text-align: center; font-weight: bold; background-color: #f8fafc;">${stat?.total !== null && stat?.total !== undefined ? stat.total : "-"}</td>
          <td style="text-align: center; font-weight: 800; color: #1e40af; background-color: #eff6ff;">${stat?.avg !== null && stat?.avg !== undefined ? stat.avg : "-"}</td>
          <td style="text-align: center; font-weight: 800; color: #b45309; background-color: #fffbeb;">${rank !== undefined ? `#${rank}` : "-"}</td>
        </tr>
      `;
    })
    .join("");

  let grandTotalAvg = 0;
  let countGrandAvg = 0;
  const colAvgHtml = sortedPembelajaran
    .map((_p, pIdx) => {
      const count = colCounts[pIdx];
      const avg = count > 0 ? Math.round((colTotals[pIdx] / count) * 10) / 10 : null;
      if (avg !== null) {
        grandTotalAvg += avg;
        countGrandAvg++;
      }
      return `<td style="text-align: center; font-weight: bold;">${avg !== null ? avg : "-"}</td>`;
    })
    .join("");

  const finalAvg = countGrandAvg > 0 ? Math.round((grandTotalAvg / countGrandAvg) * 10) / 10 : "-";

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Leger Nilai Kelas ${rombel.nama} - F4 Landscape</title>
  <style>
    @page {
      size: 330mm 215mm landscape;
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
      <p>${sekolah?.alamat || "Jl. Pulau Moyo No. 63 Pedungan"}${sekolah?.telepon ? ` • Telp: ${sekolah.telepon}` : ""} • NPSN: ${sekolah?.npsn || "50103069"}</p>
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
          ${renderSignatureCellHtml({
            topLinesHtml: "Mengetahui,<br>Kepala Sekolah",
            signatureUrl: sekolah?.capTtdKepsekUrl,
            signerName: sekolah?.namaKepsek || "-",
            signerNip: sekolah?.nipKepsek,
            isCapKepsek: true,
            spaceHeightPx: 52,
          })}
        </td>
        <td>
          ${renderSignatureCellHtml({
            topLinesHtml: `${sekolah?.desaKelurahan || "Denpasar"}, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}<br>Wali Kelas`,
            signatureUrl: rombel.waliKelas?.ttdUrl,
            signerName: rombel.waliKelas?.nama || "Wali Kelas",
            signerNip: rombel.waliKelas?.nip,
            spaceHeightPx: 52,
          })}
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
