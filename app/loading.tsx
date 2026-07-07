export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6">
      <div className="flex flex-col items-center gap-5 text-center">
<div className="flex h-[85vw] w-[85vw] max-h-[520px] max-w-[520px] items-center justify-center overflow-hidden bg-black">
<img
  src="/smartpunt-icon-512.png"
  alt="SmartPunt"
className="h-[115%] w-[115%] bg-black object-cover"
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
