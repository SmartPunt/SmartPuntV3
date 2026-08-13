export default function TheVaultLoading() {
  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden bg-black">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes vault-wheel-spin {
              0% {
                transform: rotate(-10deg);
              }

              45% {
                transform: rotate(22deg);
              }

              100% {
                transform: rotate(92deg);
              }
            }

            @keyframes vault-glow-pulse {
              0%, 100% {
                opacity: 0.35;
                transform: scale(0.96);
              }

              50% {
                opacity: 0.9;
                transform: scale(1.05);
              }
            }

            @keyframes vault-loader-rise {
              0% {
                opacity: 0;
                transform: translateY(10px);
              }

              100% {
                opacity: 1;
                transform: translateY(0);
              }
            }

            @keyframes vault-sheen {
              0% {
                opacity: 0;
                transform: translateX(-140%) rotate(12deg);
              }

              45% {
                opacity: 0.65;
              }

              100% {
                opacity: 0;
                transform: translateX(160%) rotate(12deg);
              }
            }

            @keyframes vault-loading-bar {
              0% {
                transform: translateX(-120%);
              }

              55% {
                transform: translateX(-10%);
              }

              100% {
                transform: translateX(120%);
              }
            }

            .vault-wheel-spin {
              animation:
                vault-wheel-spin 2.7s cubic-bezier(0.22, 1, 0.36, 1)
                  infinite alternate;
              transform-origin: center;
            }

            .vault-glow-pulse {
              animation: vault-glow-pulse 2.6s ease-in-out infinite;
            }

            .vault-loader-rise {
              animation: vault-loader-rise 650ms ease-out both;
            }

            .vault-loader-rise-delay {
              animation: vault-loader-rise 650ms 120ms ease-out both;
            }

            .vault-sheen {
              animation: vault-sheen 3.2s ease-in-out infinite;
            }

            .vault-loading-bar {
              animation: vault-loading-bar 1.7s ease-in-out infinite;
            }

            @media (prefers-reduced-motion: reduce) {
              .vault-wheel-spin,
              .vault-glow-pulse,
              .vault-loader-rise,
              .vault-loader-rise-delay,
              .vault-sheen,
              .vault-loading-bar {
                animation: none !important;
              }
            }
          `,
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <div className="relative h-full w-full max-w-[430px] overflow-hidden bg-black">
          <img
            src="/vault/vault-loading-base.png"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div className="vault-glow-pulse pointer-events-none absolute left-1/2 top-[39%] h-[44%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/10 blur-[55px]" />

          <div className="pointer-events-none absolute left-1/2 top-[39.5%] aspect-square w-[78%] -translate-x-1/2 -translate-y-1/2">
            <img
              src="/vault/vault-wheel-handles.png"
              alt=""
              aria-hidden="true"
              className="vault-wheel-spin h-full w-full object-contain drop-shadow-[0_0_22px_rgba(251,191,36,0.24)]"
            />
          </div>

          <div className="pointer-events-none absolute left-1/2 top-[39.5%] aspect-[350/455] w-[39%] -translate-x-1/2 -translate-y-1/2">
            <img
              src="/vault/vault-shield.png"
              alt="The Vault"
              className="h-full w-full object-contain drop-shadow-[0_0_18px_rgba(251,191,36,0.22)]"
            />

            <div className="vault-sheen absolute -left-1/2 top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-amber-100/20 to-transparent blur-sm" />
          </div>

          <div className="pointer-events-none absolute inset-x-[16%] bottom-[8.5%]">
            <div className="h-[3px] overflow-hidden rounded-full bg-white/10">
              <div className="vault-loading-bar h-full w-2/3 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent shadow-[0_0_16px_rgba(252,211,77,0.65)]" />
            </div>
          </div>

          <div className="vault-loader-rise pointer-events-none absolute inset-x-0 bottom-[4.8%] text-center">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-100/75">
              Securing access
            </p>
          </div>

          <div className="vault-loader-rise-delay pointer-events-none absolute inset-x-0 bottom-[2.3%] text-center">
            <p className="text-[7px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Preparing your Vault...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
