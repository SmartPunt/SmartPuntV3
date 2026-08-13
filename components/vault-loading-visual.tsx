"use client";

export default function VaultLoadingVisual({
  progress,
  animateWheel = false,
  finishFlash = false,
}: {
  progress?: number | null;
  animateWheel?: boolean;
  finishFlash?: boolean;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes vault-premium-turn {
              0% {
                transform: rotate(-8deg);
              }

              38% {
                transform: rotate(14deg);
              }

              72% {
                transform: rotate(54deg);
              }

              100% {
                transform: rotate(88deg);
              }
            }

@keyframes vault-final-flash {
  0% {
    opacity: 0;
  }

  18% {
    opacity: 1;
  }

  42% {
    opacity: 0.92;
  }

  100% {
    opacity: 0;
  }
}

            @keyframes vault-ambient-glow {
              0%, 100% {
                opacity: 0.28;
              }

              50% {
                opacity: 0.62;
              }
            }

            .vault-premium-turn {
              animation:
                vault-premium-turn
                2.5s
                cubic-bezier(0.22, 1, 0.36, 1)
                forwards;
              transform-origin: center;
            }

            .vault-final-flash {
              animation:
                vault-final-flash
                650ms
                ease-out
                forwards;
            }

            .vault-ambient-glow {
              animation:
                vault-ambient-glow
                2.6s
                ease-in-out
                infinite;
            }

            @media (prefers-reduced-motion: reduce) {
              .vault-premium-turn,
              .vault-final-flash,
              .vault-ambient-glow {
                animation: none !important;
              }
            }
          `,
        }}
      />

      <div className="relative h-full w-full max-w-[430px] overflow-hidden bg-black">
        <img
          src="/vault/vault-loading-base.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="pointer-events-none absolute left-1/2 top-[39.5%] aspect-square w-[76%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-[#050403]" />

        <div className="vault-ambient-glow pointer-events-none absolute left-1/2 top-[39.5%] h-[44%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/10 blur-[55px]" />

        <div className="pointer-events-none absolute left-1/2 top-[39.5%] aspect-square w-[76%] -translate-x-1/2 -translate-y-1/2">
          <div
            className={`h-full w-full ${
              animateWheel
                ? "vault-premium-turn"
                : ""
            }`}
          >
            <img
              src="/vault/vault-complete-door.png"
              alt="The Vault"
              className="h-full w-full object-contain drop-shadow-[0_0_24px_rgba(251,191,36,0.28)]"
            />
          </div>
        </div>

        <div className="pointer-events-none absolute left-1/2 top-[82.15%] flex aspect-square w-[21%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#060504]">
          {typeof progress === "number" ? (
            <span
              className="font-serif text-[25px] font-black leading-none tracking-[-0.04em] text-[#f6d474] drop-shadow-[0_1px_4px_rgba(0,0,0,1)]"
              style={{
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {progress}
              <span className="ml-[1px] text-[13px]">
                %
              </span>
            </span>
          ) : (
            <span className="font-serif text-[13px] font-black uppercase tracking-[0.12em] text-[#f6d474]">
              Loading
            </span>
          )}
        </div>

{finishFlash ? (
  <div className="vault-final-flash pointer-events-none fixed inset-0 z-50 bg-[radial-gradient(circle_at_center,rgba(255,252,225,1)_0%,rgba(254,240,138,0.98)_18%,rgba(251,191,36,0.86)_40%,rgba(245,158,11,0.52)_62%,rgba(120,53,15,0.18)_82%,transparent_100%)]" />
) : null}
      </div>
    </div>
  );
}
