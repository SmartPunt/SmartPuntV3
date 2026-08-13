export default function TheVaultLoading() {
  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden bg-black">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes vault-loading-glow {
              0%, 100% {
                opacity: 0.3;
              }

              50% {
                opacity: 0.65;
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

            .vault-loading-glow {
              animation:
                vault-loading-glow
                2.6s
                ease-in-out
                infinite;
            }

            .vault-loading-bar {
              animation:
                vault-loading-bar
                1.7s
                ease-in-out
                infinite;
            }

            @media (prefers-reduced-motion: reduce) {
              .vault-loading-glow,
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

          <div className="vault-loading-glow pointer-events-none absolute left-1/2 top-[39.5%] h-[44%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/10 blur-[55px]" />

          <div className="pointer-events-none absolute left-1/2 top-[39.5%] aspect-square w-[76%] -translate-x-1/2 -translate-y-1/2">
            <img
              src="/vault/vault-complete-door.png"
              alt="The Vault"
              className="h-full w-full object-contain drop-shadow-[0_0_24px_rgba(251,191,36,0.28)]"
            />
          </div>

          <div className="pointer-events-none absolute inset-x-[16%] bottom-[8.5%]">
            <div className="h-[3px] overflow-hidden rounded-full bg-white/10">
              <div className="vault-loading-bar h-full w-2/3 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent shadow-[0_0_16px_rgba(252,211,77,0.65)]" />
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-[4.8%] text-center">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-100/75">
              Securing access
            </p>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-[2.3%] text-center">
            <p className="text-[7px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Preparing your Vault...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
