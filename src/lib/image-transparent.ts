/**
 * Utilitas pemrosesan gambar di sisi klien (Browser Canvas):
 * 1. Validasi ekstensi & MIME (.jpg, .jpeg, .png)
 * 2. Resize & kompresi Foto Profil Pendidik
 * 3. Konversi otomatis gambar TTD Pendidik / CAP Sekolah & TTD Kepsek
 *    berlatar belakang kertas/warna solid menjadi PNG Transparan murni
 *    (lengkap dengan de-halo tepi & auto-crop presisi).
 */

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png"];
const ALLOWED_MIMES = ["image/jpeg", "image/jpg", "image/png"];

export function validateImageUploadFile(file: File): { valid: boolean; error?: string } {
  const lowerName = file.name.toLowerCase().trim();
  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const hasValidMime = ALLOWED_MIMES.includes(file.type.toLowerCase());

  if (!hasValidExt && !hasValidMime) {
    return {
      valid: false,
      error: "Format berkas harus berekstensi .jpg, .jpeg, atau .png.",
    };
  }

  if (file.size > 8 * 1024 * 1024) {
    return {
      valid: false,
      error: "Ukuran berkas maksimal 8 MB.",
    };
  }

  return { valid: true };
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca berkas gambar."));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Berkas gambar rusak atau tidak didukung."));
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function median(values: number[]): number {
  if (values.length === 0) return 255;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Memproses Foto Profil menjadi ukuran persegi presisi (center-crop)
 */
export async function processProfilePhoto(file: File, targetSize = 320): Promise<string> {
  const check = validateImageUploadFile(file);
  if (!check.valid) throw new Error(check.error);

  const img = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung pemrosesan kanvas.");

  // Center-crop persegi agar foto profil tampil presisi dan tidak gepeng
  const minSide = Math.min(img.width, img.height);
  const sx = Math.max(0, Math.floor((img.width - minSide) / 2));
  const sy = Math.max(0, Math.floor((img.height - minSide) / 2));

  ctx.clearRect(0, 0, targetSize, targetSize);
  ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);

  // Gunakan PNG jika file asli PNG, selain itu JPEG berkualitas tinggi agar ukuran ringkas
  if (file.type === "image/png" || file.name.toLowerCase().endsWith(".png")) {
    return canvas.toDataURL("image/png");
  }
  return canvas.toDataURL("image/jpeg", 0.88);
}

/**
 * Menghapus background kertas/putih/abu-abu pada TTD atau CAP Sekolah + TTD Kepsek
 * secara otomatis menjadi PNG Transparan (lengkap dengan penghilang halo putih & auto-crop).
 */
export async function processTransparentSignature(
  file: File,
  maxWidth = 600,
  maxHeight = 320
): Promise<string> {
  const check = validateImageUploadFile(file);
  if (!check.valid) throw new Error(check.error);

  const img = await loadImageFromFile(file);

  let width = img.width;
  let height = img.height;
  const scale = Math.min(1, maxWidth / Math.max(1, width), maxHeight / Math.max(1, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Browser tidak mendukung pemrosesan kanvas.");

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 1. Ambil sampel piksel di tepi gambar (keliling luar) untuk mendeteksi warna kertas/background
  const borderR: number[] = [];
  const borderG: number[] = [];
  const borderB: number[] = [];
  let borderTotal = 0;
  let borderTransparent = 0;

  const samplePixel = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    borderTotal++;
    const a = data[idx + 3];
    if (a < 35) {
      borderTransparent++;
      return;
    }
    borderR.push(data[idx]);
    borderG.push(data[idx + 1]);
    borderB.push(data[idx + 2]);
  };

  const stepX = Math.max(1, Math.floor(width / 80));
  const stepY = Math.max(1, Math.floor(height / 80));

  for (let x = 0; x < width; x += stepX) {
    samplePixel(x, 0);
    if (height > 1) samplePixel(x, height - 1);
    if (height > 4) {
      samplePixel(x, 2);
      samplePixel(x, height - 3);
    }
  }
  for (let y = 0; y < height; y += stepY) {
    samplePixel(0, y);
    if (width > 1) samplePixel(width - 1, y);
    if (width > 4) {
      samplePixel(2, y);
      samplePixel(width - 3, y);
    }
  }

  const alreadyMostlyTransparent =
    borderTotal > 0 && borderTransparent / borderTotal >= 0.6;

  const bgR = alreadyMostlyTransparent ? 255 : median(borderR);
  const bgG = alreadyMostlyTransparent ? 255 : median(borderG);
  const bgB = alreadyMostlyTransparent ? 255 : median(borderB);
  const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;

  // 2. Proses penghapusan latar belakang per piksel
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 15) {
      data[i + 3] = 0;
      continue;
    }

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC - minC; // Menjaga tinta stempel biru/ungu/merah tetap tajam!

    if (alreadyMostlyTransparent) {
      // Jika file asli sudah PNG transparan, hanya bersihkan sisa bercak putih murni jika ada
      if (a > 230 && lum > 248 && sat < 10) {
        data[i + 3] = 0;
      }
      continue;
    }

    const distBg = Math.hypot(r - bgR, g - bgG, b - bgB);
    const darkDiff = Math.max(0, bgLum - lum);

    // Sinyal tinta gabungan: jarak dari warna kertas, kegelapan goresan pena, atau kepekatan warna stempel
    let inkSignal = Math.max(distBg, darkDiff * 1.35, sat * 1.9);

    // Redam bayangan kertas tipis (terang & hampir tidak berwarna)
    if (lum > 212 && sat < 22 && distBg < 56) {
      inkSignal *= 0.55;
    }

    const lowCut = 30;
    const highCut = 80;

    if (inkSignal <= lowCut) {
      data[i + 3] = 0;
    } else if (inkSignal < highCut) {
      const t = (inkSignal - lowCut) / (highCut - lowCut);
      const smooth = t * t * (3 - 2 * t);
      const newAlpha = Math.round(a * smooth);
      data[i + 3] = newAlpha;

      // De-halo (unmix warna background dari tepi anti-alias agar tidak bergaris putih)
      if (newAlpha > 8) {
        const ratio = Math.max(0.2, smooth);
        data[i] = Math.max(0, Math.min(255, Math.round((r - bgR * (1 - ratio)) / ratio)));
        data[i + 1] = Math.max(0, Math.min(255, Math.round((g - bgG * (1 - ratio)) / ratio)));
        data[i + 2] = Math.max(0, Math.min(255, Math.round((b - bgB * (1 - ratio)) / ratio)));
      }
    } else {
      // Tinta penuh: pertajam sedikit kontras agar jelas saat dicetak di PDF/Excel
      data[i + 3] = a;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // 3. Auto-crop area transparan berlebih di sekeliling tanda tangan / stempel
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 18) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Jika seluruh kanvas kosong (mis. kertas putih polos), kembalikan apa adanya
  if (maxX < minX || maxY < minY) {
    return canvas.toDataURL("image/png");
  }

  const pad = 8;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(width - cropX, maxX - minX + 1 + pad * 2);
  const cropH = Math.min(height - cropY, maxY - minY + 1 + pad * 2);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = cropW;
  outCanvas.height = cropH;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) return canvas.toDataURL("image/png");

  outCtx.clearRect(0, 0, cropW, cropH);
  outCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  return outCanvas.toDataURL("image/png");
}
