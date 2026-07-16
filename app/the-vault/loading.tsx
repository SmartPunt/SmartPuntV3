import VaultDoorIcon from "@/components/vault-door-icon";

export default function TheVaultLoading() {
  return (
    <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center overflow-hidden bg-[#020202] text-white">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes vault-wheel-turn {
              0% {
                transform: rotate(-18deg);
              }
              35% {
                transform: rotate(0deg);
              }
              70% {
                transform: rotate(48deg);
              }
              100% {
                transform: rotate(72deg);
              }
            }

            @keyframes vault-door-breathe {
              0%, 100% {
                transform: scale(0.96);
              }
              50% {
                transform: scale(1);
              }
            }

            @keyframes vault-glow {
              0%, 100% {
                opacity: 0.35;
                transform: scale(0.86);
              }
              50% {
                opacity: 0.95;
                transform: scale(1.12);
              }
            }

            @keyframes vault-ring-pulse {
              0% {
                opacity: 0;
                transform: scale(0.72);
              }
              45% {
                opacity: 0.5;
              }
              100% {
                opacity: 0;
                transform: scale(1.35);
              }
            }

            @keyframes vault-text-rise {
              0% {
                opacity: 0;
                transform: translateY(12px);
              }
              100% {
                opacity: 1;
                transform: translateY(0);
              }
            }

            @keyframes vault-loading-bar {
              0% {
                transform: translateX(-110%);
              }
              55% {
                transform: translateX(-15%);
              }
              100% {
                transform: translateX(110%);
              }
            }

            @keyframes vault-particle-one {
              0%, 100% {
                opacity: 0.15;
                transform: translate3d(0, 8px, 0);
              }
              50% {
                opacity: 0.75;
                transform: translate3d(5px, -16px, 0);
              }
            }

            @keyframes vault-particle-two {
              0%, 100% {
                opacity: 0.1;
                transform: translate3d(0, 4px, 0);
              }
              50% {
                opacity: 0.6;
                transform: translate3d(-8px, -20px, 0);
              }
            }

            .vault-wheel-animation {
              animation:
                vault-wheel-turn 2.2s cubic-bezier(0.22, 1, 0.36, 1)
                  infinite alternate,
                vault-door-breathe 2.8s ease-in-out infinite;
              transform-origin: center;
              transform-box: fill-box;
            }

            .vault-glow-animation {
              animation: vault-glow 2.4s ease-in-out infinite;
            }

            .vault-ring-animation {
              animation: vault-ring-pulse 2.2s ease-out infinite;
            }

            .vault-title-animation {
              animation: vault-text-rise 700ms ease-out both;
            }

            .vault-subtitle-animation {
              animation: vault-text-rise 700ms 140ms ease-out both;
            }

            .vault-bar-animation {
              animation: vault-loading-bar 1.7s ease-in-out infinite;
            }

            .vault-particle-one {
              animation: vault-particle-one 3.2s ease-in-out infinite;
            }

            .vault-particle-two {
              animation: vault-particle-two 3.8s ease-in-out infinite;
            }

            @media (prefers-reduced-motion: reduce) {
              .vault-wheel-animation,
              .vault-glow-animation,
              .vault-ring-animation,
              .vault-title-animation,
              .vault-subtitle-animation,
              .vault-bar-animation,
              .vault-particle-one,
              .vault-particle-two {
                animation: none !important;
              }
            }
          `,
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.13),transparent_34%),radial-gradient(circle_at_50%_62%,rgba(180,83,9,0.08),transparent_42%),linear-gradient(180deg,#010101_0%,#080604_52%,#010101_100%)]" />

      <div className="vault-glow-animation pointer-events-none absolute h-72 w-72 rounded-full bg-amber-400/15 blur-[80px] sm:h-96 sm:w-96" />

      <div className="vault-ring-animation pointer-events-none absolute h-52 w-52 rounded-full border border-amber-300/20 sm:h-64 sm:w-64" />

      <span className="vault-particle-one absolute left-[18%] top-[28%] h-1 w-1 rounded-full bg-amber-200 shadow-[0_0_14px_rgba(253,230,138,0.9)]" />

      <span className="vault-particle-two absolute right-[20%] top-[35%] h-1.5 w-1.5 rounded-full bg-amber-300/80 shadow-[0_0_18px_rgba(252,211,77,0.8)]" />

      <span className="vault-particle-one absolute bottom-[28%] right-[28%] h-1 w-1 rounded-full bg-yellow-200/80 shadow-[0_0_12px_rgba(254,240,138,0.8)]" />

      <div className="relative flex w-full max-w-md flex-col items-center px-6 text-center">
        <div className="relative flex h-52 w-52 items-center justify-center sm:h-64 sm:w-64">
          <div className="absolute inset-2 rounded-full border border-amber-300/20 bg-[radial-gradient(circle_at_35%_28%,rgba(253,230,138,0.15),transparent_26%),linear-gradient(145deg,rgba(63,63,70,0.48),rgba(9,9,11,0.98))] shadow-[0_0_70px_rgba(245,158,11,0.18),inset_0_0_30px_rgba(255,255,255,0.04)]" />

          <div className="absolute inset-6 rounded-full border border-amber-300/25 bg-black/70 shadow-[inset_0_0_26px_rgba(245,158,11,0.08)]" />

          <div className="vault-wheel-animation relative flex h-40 w-40 items-center justify-center text-amber-300 drop-shadow-[0_0_24px_rgba(252,211,77,0.6)] sm:h-48 sm:w-48">
            <VaultDoorIcon className="h-full w-full" />
          </div>

          <div className="absolute left-1 top-1/2 h-16 w-5 -translate-y-1/2 rounded-l-xl border-y border-l border-amber-300/30 bg-zinc-800 shadow-[inset_0_0_8px_rgba(255,255,255,0.08)]" />

          <div className="absolute right-6 top-1/2 flex -translate-y-1/2 flex-col gap-4">
            <span className="h-2.5 w-2.5 rounded-full border border-amber-200/50 bg-amber-300/70 shadow-[0_0_10px_rgba(252,211,77,0.55)]" />
            <span className="h-2.5 w-2.5 rounded-full border border-amber-200/50 bg-amber-300/70 shadow-[0_0_10px_rgba(252,211,77,0.55)]" />
            <span className="h-2.5 w-2.5 rounded-full border border-amber-200/50 bg-amber-300/70 shadow-[0_0_10px_rgba(252,211,77,0.55)]" />
            <span className="h-2.5 w-2.5 rounded-full border border-amber-200/50 bg-amber-300/70 shadow-[0_0_10px_rgba(252,211,77,0.55)]" />
            <span className="h-2.5 w-2.5 rounded-full border border-amber-200/50 bg-amber-300/70 shadow-[0_0_10px_rgba(252,211,77,0.55)]" />
          </div>
        </div>

        <div className="vault-title-animation mt-4">
          <p className="text-[10px] font-black uppercase tracking-[0.42em] text-amber-300/80">
            SmartPunt
          </p>

          <h1 className="mt-3 bg-gradient-to-b from-amber-100 via-yellow-300 to-amber-500 bg-clip-text text-4xl font-black uppercase tracking-[0.16em] text-transparent sm:text-5xl">
            The Vault
          </h1>
        </div>

        <p className="vault-subtitle-animation mt-4 text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
          Opening your racing intelligence
        </p>

        <div className="mt-7 h-1 w-48 overflow-hidden rounded-full bg-white/10">
          <div className="vault-bar-animation h-full w-2/3 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent shadow-[0_0_16px_rgba(252,211,77,0.7)]" />
        </div>

        <p className="mt-4 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
          Your horses · Your rules · Your edge
        </p>
      </div>
    </div>
  );
}
