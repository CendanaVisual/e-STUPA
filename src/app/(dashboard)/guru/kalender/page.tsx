import { db } from "@/lib/db";

export default async function GuruKalenderPage() {
  const activeSemester = await db.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  });

  const kegiatan = activeSemester
    ? await db.kalenderAkademik.findMany({
        where: { semesterId: activeSemester.id },
        orderBy: { tanggalMulai: "asc" },
      })
    : [];

  const kategoriColors: Record<string, { bg: string; text: string; border: string }> = {
    Akademik: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    Ujian: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
    Libur: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
    "Kegiatan Sekolah": { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
    Rapat: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[10px] tracking-wider uppercase">
            Kalender Akademik
          </span>
          <span className="text-slate-400 text-xs">•</span>
          <span className="text-xs text-slate-500 font-medium">
            T.A. {activeSemester?.tahunAjaran.nama ?? "2026/2027"} {activeSemester?.tipe ?? "GANJIL"}
          </span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Kalender Pendidikan & Jadwal Sekolah
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Pantau jadwal penting seperti asesmen, rapat, pekan pengisian nilai rapor, dan libur akademik.
        </p>
      </div>

      <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
        {kegiatan.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-2">
            <i className="fa-regular fa-calendar-xmark text-3xl text-slate-300" />
            <p className="text-xs font-bold text-slate-600">Belum ada agenda kegiatan yang dicatat.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {kegiatan.map((item) => {
              const style = kategoriColors[item.kategori] || kategoriColors.Akademik;
              const tglMulai = new Date(item.tanggalMulai).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              const tglSelesai = item.tanggalSelesai
                ? new Date(item.tanggalSelesai).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : null;

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition bg-slate-50/50 flex items-start gap-3.5"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-blue-600 flex flex-col items-center justify-center shrink-0 shadow-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">
                      {new Date(item.tanggalMulai).toLocaleDateString("id-ID", { month: "short" })}
                    </span>
                    <span className="text-base font-extrabold leading-none mt-1">
                      {new Date(item.tanggalMulai).getDate()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-800 truncate">{item.judulKegiatan}</h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${style.bg} ${style.text} ${style.border}`}
                      >
                        {item.kategori}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {tglMulai} {tglSelesai ? `— ${tglSelesai}` : ""}
                    </p>
                    {item.keterangan && (
                      <p className="text-[11px] text-slate-400 mt-1 italic">{item.keterangan}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
