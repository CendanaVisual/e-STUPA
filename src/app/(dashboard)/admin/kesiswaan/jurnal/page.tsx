import { db } from "@/lib/db";
import { tambahJurnal, hapusJurnal } from "@/server/actions/kesiswaan";
import { safeFormatDate } from "@/lib/date";

export default async function AdminJurnalPage(props: {
  searchParams?: Promise<{ date?: string; rombelId?: string; mapelId?: string }>;
}) {
  const sp = props?.searchParams ? await props.searchParams : {};
  const selectedDateStr = sp?.date || new Date().toISOString().split("T")[0];
  const selectedRombelId = sp?.rombelId || "";
  const selectedMapelId = sp?.mapelId || "";

  let selectedDate = new Date(selectedDateStr);
  if (isNaN(selectedDate.getTime())) {
    selectedDate = new Date();
  }

  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  });

  const [rombelList, mapelList, allSiswa, jurnalList] = await Promise.all([
    activeSemester
      ? db.rombel.findMany({
          where: { semesterId: activeSemester.id },
          orderBy: { nama: "asc" },
        })
      : [],
    db.mapel.findMany({
      where: { isAktif: true },
      orderBy: { urutan: "asc" },
    }),
    activeSemester
      ? db.siswa.findMany({
          where: {
            status: "AKTIF",
            anggotaRombel: { some: { semesterId: activeSemester.id } },
          },
          include: {
            anggotaRombel: {
              where: { semesterId: activeSemester.id },
              include: { rombel: true },
            },
          },
          orderBy: { nama: "asc" },
        })
      : [],
    activeSemester
      ? db.jurnalPerkembangan.findMany({
          where: {
            semesterId: activeSemester.id,
            ...(selectedDateStr ? { tanggal: selectedDate } : {}),
            ...(selectedRombelId ? { rombelId: selectedRombelId } : {}),
          },
          include: {
            siswa: {
              include: {
                anggotaRombel: {
                  where: { semesterId: activeSemester.id },
                  include: { rombel: true },
                },
              },
            },
            rombel: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : [],
  ]);

  const hariAngka = selectedDate.getDay();
  const namaHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][hariAngka] || "Hari";
  const formattedTgl = safeFormatDate(selectedDate, { day: "numeric", month: "short", year: "numeric" });

  // Filter siswa jika rombel terpilih
  const filteredSiswa = selectedRombelId
    ? allSiswa.filter((s) => s.anggotaRombel[0]?.rombelId === selectedRombelId)
    : allSiswa;

  const DIMENSI_LIST = [
    "Beriman & Bertakwa",
    "Berkebinekaan Global",
    "Gotong Royong",
    "Mandiri",
    "Bernalar Kritis",
    "Kreatif",
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* HEADER SESUAI GAMBAR 5 */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
          Jurnal Perkembangan Murid
        </h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Observasi pembelajaran yang terhubung ke jadwal. Catatan tersimpan di profil murid.
        </p>
      </div>

      {/* 2 COLUMNS GRID SESUAI GAMBAR 5 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* PANEL KIRI: JURNAL BARU (COL 1-2) */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[2rem] p-5 shadow-xs border border-slate-200/90 space-y-4">
            <h2 className="font-black text-slate-800 text-sm flex items-center gap-2">
              <i className="fa-solid fa-pen-nib text-[#e11d48]" />
              <span>Jurnal Baru</span>
            </h2>

            {/* STEP 1: PILIH TANGGAL */}
            <div>
              <label className="text-xs font-extrabold text-slate-500 mb-1.5 block">
                1 · Pilih Tanggal
              </label>
              <form method="GET">
                <input
                  type="date"
                  name="date"
                  defaultValue={selectedDateStr}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
                {selectedRombelId && <input type="hidden" name="rombelId" value={selectedRombelId} />}
                {selectedMapelId && <input type="hidden" name="mapelId" value={selectedMapelId} />}
              </form>
            </div>

            {/* STEP 2: PILIH SLOT JADWAL / KELAS */}
            <div>
              <label className="text-xs font-extrabold text-slate-500 mb-1.5 block">
                2 · Pilih Slot Jadwal
              </label>

              {rombelList.length === 0 ? (
                <div className="text-xs font-bold text-slate-400 bg-slate-50 rounded-2xl p-3 border border-slate-100">
                  Tidak ada slot jadwal Anda pada hari {namaHari} ({formattedTgl}). Periksa menu Jadwal Pelajaran.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {rombelList.map((r) => {
                    const isSelected = selectedRombelId === r.id;
                    const mapelNama = mapelList[r.tingkat % mapelList.length]?.nama || "Tematik / Intrakurikuler";

                    return (
                      <a
                        key={r.id}
                        href={`/admin/kesiswaan/jurnal?date=${selectedDateStr}&rombelId=${r.id}`}
                        className={`w-full text-left p-3 rounded-2xl border transition flex items-center gap-3 ${
                          isSelected
                            ? "border-rose-400 bg-rose-50/50"
                            : "border-slate-200 bg-white hover:border-rose-200"
                        }`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-black shrink-0">
                          {r.nama}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-black text-slate-800 text-xs truncate">
                            {mapelNama}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400">
                            Kelas {r.nama} · 07:30–09:00 · Intrakurikuler
                          </div>
                        </div>
                        <i
                          className={`fa-solid ${
                            isSelected ? "fa-circle-check text-rose-500" : "fa-regular fa-circle text-slate-300"
                          } text-sm`}
                        />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* FORM OBSERVASI */}
            <form action={tambahJurnal} className="space-y-3 pt-3 border-t border-slate-100">
              <input type="hidden" name="tanggal" value={selectedDateStr} />
              <input type="hidden" name="rombelId" value={selectedRombelId} />

              <div>
                <label className="text-xs font-extrabold text-slate-500 mb-1 block">
                  3 · Pilih Murid
                </label>
                <select
                  name="siswaId"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                >
                  <option value="">-- Pilih Murid yang Diobservasi --</option>
                  {filteredSiswa.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama} ({s.anggotaRombel[0]?.rombel?.nama ?? "-"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-500 mb-1 block">
                  Dimensi Profil Pancasila
                </label>
                <select
                  name="dimensiProfil"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                >
                  {DIMENSI_LIST.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-500 mb-1 block">
                  Butir Sikap
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-emerald-700 cursor-pointer">
                    <input type="radio" name="butirSikap" value="Positif" defaultChecked />
                    <span>Positif</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-rose-700 cursor-pointer">
                    <input type="radio" name="butirSikap" value="Perlu Pembinaan" />
                    <span>Perlu Bimbingan</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-500 mb-1 block">
                  Catatan Observasi Perkembangan
                </label>
                <textarea
                  name="catatan"
                  required
                  rows={2}
                  placeholder="Catatan perilaku, inisiatif gotong royong, atau kemandirian belajar..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-500 mb-1 block">
                  Tindak Lanjut
                </label>
                <input
                  type="text"
                  name="tindakLanjut"
                  placeholder="Apresiasi di depan kelas, motivasi berkala..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 transition cursor-pointer"
              >
                Simpan ke Jurnal
              </button>
            </form>
          </div>
        </div>

        {/* PANEL KANAN: JURNAL TERCATAT (COL 3-5) */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-[2rem] p-5 shadow-xs border border-slate-200/90 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="font-black text-slate-800 text-sm">Jurnal Tercatat</h2>
              <span className="text-xs font-bold text-slate-400">
                {jurnalList.length} observasi tercatat
              </span>
            </div>

            {jurnalList.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-bold">
                Belum ada jurnal. Pilih tanggal &amp; slot jadwal di panel kiri.
              </div>
            ) : (
              <div className="space-y-3">
                {jurnalList.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition bg-slate-50/50 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800">{item.siswa.nama}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({item.siswa.anggotaRombel[0]?.rombel?.nama ?? "-"})
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                          {item.dimensiProfil}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            item.butirSikap === "Positif"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {item.butirSikap || "Positif"}
                        </span>

                        <form action={hapusJurnal} className="inline">
                          <input type="hidden" name="id" value={item.id} />
                          <button
                            type="submit"
                            title="Hapus"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <i className="fa-solid fa-trash-can text-xs" />
                          </button>
                        </form>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-100">
                      {item.catatan}
                    </p>

                    {item.tindakLanjut && (
                      <p className="text-[11px] text-slate-500 italic pl-1">
                        <span className="font-semibold text-slate-600">Tindak Lanjut:</span> {item.tindakLanjut}
                      </p>
                    )}

                    <div className="text-[10px] text-slate-400 pt-1">
                      Tanggal: {safeFormatDate(item.tanggal, { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
