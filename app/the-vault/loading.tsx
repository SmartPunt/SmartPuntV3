import VaultDoorIcon from "@/components/vault-door-icon";

export default function TheVaultLoading() {
  const handles = Array.from({ length: 8 });

  return (
    <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center overflow-hidden bg-[#020202] text-white">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes vault-wheel-turn {
              0% {
                transform: rotate(-12deg);
              }
              35% {
                transform: rotate(8deg);
              }
              70% {
                transform: rotate(58deg);
              }
              100% {
                transform: rotate(96deg);
              }
            }

            @keyframes vault-door-breathe {
              0%, 100% {
                transform: scale(0.985);
              }
              50% {
                transform: scale(1);
              }
            }

            @keyframes vault-glow {
              0%, 100% {
                opacity: 0.35;
                transform: scale(0.9);
              }
              50% {
                opacity: 1;
                transform: scale(1.08);
              }
            }

            @keyframes vault-ring-pulse {
              0% {
                opacity: 0;
                transform: scale(0.82);
              }
              45% {
                opacity: 0.45;
              }
              100% {
                opacity: 0;
                transform: scale(1.22);
              }
            }

            @keyframes vault-text-rise {
              0% {
                opacity: 0;
                transform: translateY(10px);
              }
              100% {
                opacity: 1;
                transform: translateY(0);
              }
            }

            @keyframes vault-loading-bar {
              0% {
                transform: translateX(-115%);
              }
              55% {
                transform: translateX(-10%);
              }
              100% {
                transform: translateX(115%);
              }
            }

            @keyframes vault-particle-one {
              0%, 100% {
                opacity: 0.12;
                transform: translate3d(0, 8px, 0);
              }
              50% {
                opacity: 0.8;
                transform: translate3d(5px, -18px, 0);
              }
            }

            @keyframes vault-particle-two {
              0%, 100% {
                opacity: 0.08;
                transform: translate3d(0, 4px, 0);
              }
              50% {
                opacity: 0.65;
                transform: translate3d(-8px, -22px, 0);
              }
            }

            @keyframes vault-shine {
              0% {
                opacity: 0;
                transform: translateX(-140%) rotate(12deg);
              }
              45% {
                opacity: 0.9;
              }
              100% {
                opacity: 0;
                transform: translateX(160%) rotate(12deg);
              }
            }

            .vault-wheel-animation {
              animation:
                vault-wheel-turn 2.6s cubic-bezier(0.22, 1, 0.36, 1)
                  infinite alternate,
                vault-door-breathe 3.2s ease-in-out infinite;
              transform-origin: center;
            }

            .vault-glow-animation {
              animation: vault-glow 2.8s ease-in-out infinite;
            }

            .vault-ring-animation {
              animation: vault-ring-pulse 2.5s ease-out infinite;
            }

            .vault-title-animation {
              animation: vault-text-rise 700ms ease-out both;
            }

            .vault-subtitle-animation {
              animation: vault-text-rise 700ms 140ms ease-out both;
            }

            .vault-bar-animation {
              animation: vault-loading-bar 1.8s ease-in-out infinite;
            }

            .vault-particle-one {
              animation: vault-particle-one 3.2s ease-in-out infinite;
            }

            .vault-particle-two {
              animation: vault-particle-two 3.8s ease-in-out infinite;
            }

            .vault-shine-animation {
              animation: vault-shine 3.4s ease-in-out infinite;
            }

            @media (prefers-reduced-motion: reduce) {
              .vault-wheel-animation,
              .vault-glow-animation,
              .vault-ring-animation,
              .vault-title-animation,
              .vault-subtitle-animation,
              .vault-bar-animation,
              .vault-particle-one,
              .vault-particle-two,
              .vault-shine-animation {
                animation: none !important;
              }
            }
          `,
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(245,158,11,0.18),transparent_26%),radial-gradient(circle_at_50%_58%,rgba(180,83,9,0.10),transparent_42%),linear-gradient(180deg,#010101_0%,#080604_48%,#010101_100%)]" />

      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_center,rgba(251,191,36,0.18)_1px,transparent_1px)] [background-size:26px_26px]" />

      <div className="vault-glow-animation pointer-events-none absolute top-[24%] h-80 w-80 rounded-full bg-amber-400/20 blur-[95px] sm:h-[430px] sm:w-[430px]" />

      <div className="vault-ring-animation pointer-events-none absolute top-[28%] h-72 w-72 rounded-full border border-amber-300/20 sm:h-80 sm:w-80" />

      <span className="vault-particle-one absolute left-[12%] top-[24%] h-1 w-1 rounded-full bg-amber-200 shadow-[0_0_14px_rgba(253,230,138,0.9)]" />
      <span className="vault-particle-two absolute right-[16%] top-[31%] h-1.5 w-1.5 rounded-full bg-amber-300/80 shadow-[0_0_18px_rgba(252,211,77,0.8)]" />
      <span className="vault-particle-one absolute bottom-[25%] right-[24%] h-1 w-1 rounded-full bg-yellow-200/80 shadow-[0_0_12px_rgba(254,240,138,0.8)]" />
      <span className="vault-particle-two absolute bottom-[34%] left-[20%] h-1 w-1 rounded-full bg-amber-200/70 shadow-[0_0_14px_rgba(253,230,138,0.75)]" />

      <div className="relative flex h-full w-full max-w-[430px] flex-col items-center justify-center px-5 py-6 text-center">
        <div className="vault-title-animation mb-4 flex flex-col items-center">
          <img
            src="/header-logo.png"
            alt="Fortune on 5"
            className="h-20 w-auto object-contain drop-shadow-[0_0_22px_rgba(251,191,36,0.48)] sm:h-24"
          />
        </div>

        <div className="relative flex h-[300px] w-[300px] items-center justify-center sm:h-[340px] sm:w-[340px]">
          <div className="absolute inset-0 rounded-full border border-amber-300/25 bg-[radial-gradient(circle_at_35%_28%,rgba(253,230,138,0.16),transparent_24%),linear-gradient(145deg,rgba(63,63,70,0.72),rgba(9,9,11,0.99))] shadow-[0_0_90px_rgba(245,158,11,0.22),inset_0_0_36px_rgba(255,255,255,0.05)]" />

          <div className="absolute inset-[12px] rounded-full border-[3px] border-amber-300/30 bg-[radial-gradient(circle_at_center,rgba(17,17,17,0.98),rgba(0,0,0,1))] shadow-[inset_0_0_38px_rgba(245,158,11,0.10)]" />

          <div className="absolute inset-[26px] rounded-full border border-amber-200/20 bg-[radial-gradient(circle_at_center,rgba(41,37,36,0.8),rgba(0,0,0,0.98))]" />

          <div className="vault-wheel-animation absolute inset-[22px]">
            {handles.map((_, index) => {
              const angle = index * 45;

              return (
                <span
                  key={index}
                  className="absolute left-1/2 top-1/2 h-[42%] w-4 -translate-x-1/2 -translate-y-full origin-bottom"
                  style={{
                    transform: `translate(-50%, -100%) rotate(${angle}deg)`,
                  }}
                >
                  <span className="absolute left-1/2 top-0 h-14 w-4 -translate-x-1/2 rounded-full border border-amber-100/35 bg-[linear-gradient(90deg,#5f3b0b_0%,#f4d67b_38%,#9a6216_60%,#3b2407_100%)] shadow-[0_0_14px_rgba(251,191,36,0.18)]" />

                  <span className="absolute left-1/2 top-[46px] h-8 w-8 -translate-x-1/2 rounded-full border border-amber-100/30 bg-[radial-gradient(circle_at_35%_30%,#fde68a_0%,#b7791f_35%,#3d2506_100%)] shadow-[0_0_12px_rgba(251,191,36,0.16)]" />
                </span>
              );
            })}

            <div className="absolute inset-[22%] flex items-center justify-center rounded-full border border-amber-300/30 bg-black/80 shadow-[inset_0_0_28px_rgba(245,158,11,0.10)]">
              <div className="relative flex h-[78%] w-[78%] items-center justify-center overflow-hidden rounded-[28%] border border-amber-200/30 bg-[linear-gradient(145deg,rgba(31,41,55,0.96),rgba(5,5,5,0.99))] shadow-[0_0_24px_rgba(251,191,36,0.16)]">
                <div className="vault-shine-animation absolute -left-1/2 top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-amber-100/20 to-transparent blur-sm" />

                <div className="flex h-full w-full flex-col items-center justify-center">
                  <VaultDoorIcon className="h-20 w-20 text-amber-300 drop-shadow-[0_0_18px_rgba(252,211,77,0.45)] sm:h-24 sm:w-24" />

                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.28em] text-amber-200/80">
                    The
                  </p>

                  <h1 className="mt-1 bg-gradient-to-b from-amber-100 via-yellow-300 to-amber-500 bg-clip-text text-3xl font-black uppercase tracking-[0.08em] text-transparent sm:text-4xl">
                    Vault
                  </h1>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute left-1 top-1/2 h-24 w-7 -translate-y-1/2 rounded-l-2xl border-y border-l border-amber-300/30 bg-[linear-gradient(180deg,#3f3f46,#18181b)] shadow-[inset_0_0_10px_rgba(255,255,255,0.08)]" />
        </div>

        <p className="vault-subtitle-animation mt-5 text-sm font-black uppercase tracking-[0.26em] text-amber-200">
          Your Horses · Your Edge
        </p>

        <div className="mt-6">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300/80">
            Loading
          </p>

          <div className="relative mx-auto mt-3 flex h-20 w-20 items-center justify-center rounded-full border border-amber-300/20 bg-black/70 shadow-[0_0_28px_rgba(245,158,11,0.16)]">
            <div className="absolute inset-1 rounded-full border border-amber-300/20" />

            <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-r-amber-300 border-t-amber-300 [animation:spin_1.4s_linear_infinite]" />

            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-100">
              Secure
            </span>
          </div>
        </div>

        <div className="mt-5 h-1 w-48 overflow-hidden rounded-full bg-white/10">
          <div className="vault-bar-animation h-full w-2/3 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent shadow-[0_0_16px_rgba(252,211,77,0.7)]" />
        </div>

        <p className="mt-4 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Preparing your Vault...
        </p>
      </div>
    </div>
  );
}
