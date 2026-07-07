export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-[2rem] bg-black shadow-[0_0_45px_rgba(245,158,11,0.35)] sm:h-40 sm:w-40">
          <img
            src="/smartpunt-icon-512.png"
            alt="SmartPunt"
            className="h-full w-full object-cover"
          />
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.35em] text-amber-300">
            SmartPunt
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-400">
            Loading racing intelligence...
          </p>
        </div>
      </div>
    </main>
  );
}
