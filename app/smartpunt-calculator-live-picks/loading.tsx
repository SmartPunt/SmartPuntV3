export default function Loading() {
  return (
    <main className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-black">
      <div className="relative flex min-h-[100dvh] w-full items-center justify-center">
        {/* Final SmartPunt Live Picks artwork */}
        <img
          src="/smartpunt-live-picks-loading.png"
          alt="SmartPunt Live Picks loading"
          className="block max-h-[100dvh] w-full max-w-[768px] object-contain"
        />

        {/*
          Lightweight animated energy sweep.

          Deliberately uses no blur filters because large blurred,
          absolutely-positioned elements have caused Safari/WebKit
          rendering problems on iPhone elsewhere in SmartPunt.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-[61%] mx-auto h-[2px] w-[68%] max-w-[520px] overflow-hidden opacity-70"
        >
          <div className="smartpunt-live-picks-energy h-full w-[28%]" />
        </div>
      </div>

      <style>{`
        @keyframes smartpunt-live-picks-sweep {
          0% {
            transform: translateX(-120%);
            opacity: 0;
          }

          15% {
            opacity: 0.9;
          }

          50% {
            opacity: 1;
          }

          85% {
            opacity: 0.9;
          }

          100% {
            transform: translateX(430%);
            opacity: 0;
          }
        }

        .smartpunt-live-picks-energy {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(212, 175, 55, 0.95) 30%,
            rgba(255, 255, 255, 0.95) 50%,
            rgba(0, 230, 145, 0.95) 70%,
            transparent 100%
          );

          animation:
            smartpunt-live-picks-sweep
            2.4s
            ease-in-out
            infinite;

          will-change: transform, opacity;
        }

        @media (prefers-reduced-motion: reduce) {
          .smartpunt-live-picks-energy {
            animation: none;
            opacity: 0;
          }
        }
      `}</style>
    </main>
  );
}
