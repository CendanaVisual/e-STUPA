import "server-only";
import type ExcelJS from "exceljs";

/**
 * Mengekstrak payload base64 murni & ekstensi gambar dari Data URL
 */
export function parseDataUrlImage(
  dataUrl?: string | null
): { base64: string; extension: "png" | "jpeg" } | null {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const trimmed = dataUrl.trim();
  const match = trimmed.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!match) return null;

  const rawExt = match[1].toLowerCase();
  const extension: "png" | "jpeg" = rawExt === "png" ? "png" : "jpeg";
  const base64 = match[2].trim();
  if (!base64) return null;

  return { base64, extension };
}

/**
 * Menyematkan gambar TTD Pendidik atau CAP Sekolah & TTD Kepsek transparan
 * ke dalam worksheet ExcelJS pada posisi kolom & baris tanda tangan.
 */
export function addSignatureToWorksheet(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  dataUrl: string | null | undefined,
  opts: {
    col: number; // 0-based fractional column index di ExcelJS tl
    row: number; // 0-based fractional row index di ExcelJS tl
    width?: number;
    height?: number;
  }
): void {
  const parsed = parseDataUrlImage(dataUrl);
  if (!parsed) return;

  try {
    const imageId = wb.addImage({
      base64: parsed.base64,
      extension: parsed.extension,
    });

    ws.addImage(imageId, {
      tl: { col: opts.col, row: opts.row },
      ext: {
        width: opts.width ?? 135,
        height: opts.height ?? 62,
      },
      editAs: "oneCell",
    });
  } catch (err) {
    console.warn("[addSignatureToWorksheet] Gagal menyematkan gambar TTD:", err);
  }
}

/**
 * Menghasilkan blok HTML tanda tangan siap cetak (PDF) lengkap dengan
 * gambar TTD Pendidik atau CAP Sekolah & TTD Kepala Sekolah transparan.
 */
export function renderSignatureCellHtml(opts: {
  topLinesHtml: string;
  signatureUrl?: string | null;
  signerName: string;
  signerNip?: string | null;
  isCapKepsek?: boolean;
  spaceHeightPx?: number;
}): string {
  const heightPx = opts.spaceHeightPx ?? 56;
  const imgMaxH = opts.isCapKepsek ? heightPx + 14 : heightPx + 4;
  const imgMaxW = opts.isCapKepsek ? 190 : 155;
  const hasImg = Boolean(opts.signatureUrl && opts.signatureUrl.startsWith("data:image/"));

  const sigVisualHtml = hasImg
    ? `<div style="height: ${heightPx}px; display: flex; align-items: center; justify-content: center; overflow: visible; position: relative; margin: 2px 0;">
         <img src="${opts.signatureUrl}" alt="Tanda Tangan" style="max-height: ${imgMaxH}px; max-width: ${imgMaxW}px; width: auto; height: auto; object-fit: contain; pointer-events: none; position: relative; z-index: 2;" />
       </div>`
    : `<div style="height: ${heightPx}px;"></div>`;

  return `
    <p style="margin: 0 0 2px 0;">${opts.topLinesHtml}</p>
    ${sigVisualHtml}
    <p style="font-weight: bold; text-decoration: underline; margin: 0 0 2px 0; position: relative; z-index: 3;">${opts.signerName}</p>
    <p style="margin: 0;">NIP. ${opts.signerNip || "-"}</p>
  `;
}
