export default function Loading() {
  return (
    <main className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-black">
      <div className="relative flex min-h-[100dvh] w-full items-center justify-center">
        <img
          src="/smartpunt-live-picks-loading.png"
          alt="SmartPunt Live Picks loading"
          className="block max-h-[100dvh] w-full max-w-[768px] object-contain"
        />

        {/* Lightning strike */}
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute left-1/2 top-0 h-[58%] w-[18%] -translate-x-1/2"
        >
          <polyline
            points="52,0 46,18 56,18 42,40 51,40 45,58 53,58 49,78 52,78 50,100"
            className="smartpunt-lightning smartpunt-lightning-core"
          />
          <polyline
            points="52,0 46,18 56,18 42,40 51,40 45,58 53,58 49,78 52,78 50,100"
            className="smartpunt-lightning smartpunt-lightning-gold"
          />
        </svg>

        {/* Impact point over LIVE PICKS */}
        <div
          aria-hidden="true"
          className="smartpunt-impact pointer-events-none absolute left-1/2 top-[44.8%] h-3 w-3 -translate-x-1/2 rounded-full"
        />

        {/* LIVE PICKS energise overlay */}
        <div
          aria-hidden="true"
          className="smartpunt-title-charge pointer-events-none absolute left-1/2 top-[40.4%] h-[10.5%] w-[78%] max-w-[600px] -translate-x-1/2 overflow-hidden"
        >
          <div className="smartpunt-title-charge-sweep h-full w-[24%]" />
        </div>

        {/* Progress bar travelling energy */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-[61%] mx-auto h-[2px] w-[68%] max-w-[520px] overflow-hidden opacity-80"
        >
          <div className="smartpunt-progress-energy h-full w-[28%]" />
        </div>
      </div>

      <style>{`
        @keyframes smartpunt-lightning-strike {
          0%,
          8%,
          100% {
            opacity: 0;
            stroke-dashoffset: 220;
          }

          10% {
            opacity: 1;
            stroke-dashoffset: 220;
          }

          16% {
            opacity: 1;
            stroke-dashoffset: 0;
          }

          20% {
            opacity: 0.35;
          }

          24% {
            opacity: 1;
          }

          30% {
            opacity: 0;
          }
        }

        @keyframes smartpunt-impact-flash {
          0%,
          14%,
          100% {
            opacity: 0;
            transform: translateX(-50%) scale(0.5);
          }

          16% {
            opacity: 1;
            transform: translateX(-50%) scale(1.8);
          }

          21% {
            opacity: 0.65;
            transform: translateX(-50%) scale(1.15);
          }

          28% {
            opacity: 0;
            transform: translateX(-50%) scale(0.7);
          }
        }

        @keyframes smartpunt-title-energise {
          0%,
          14%,
          100% {
            transform: translateX(-150%);
            opacity: 0;
          }

          18% {
            opacity: 0.95;
          }

          34% {
            transform: translateX(420%);
            opacity: 0.8;
          }

          40% {
            opacity: 0;
          }
        }

        @keyframes smartpunt-progress-sweep {
          0% {
            transform: translateX(-125%);
            opacity: 0;
          }

          12% {
            opacity: 0.9;
          }

          50% {
            opacity: 1;
          }

          88% {
            opacity: 0.9;
          }

          100% {
            transform: translateX(430%);
            opacity: 0;
          }
        }

        .smartpunt-lightning {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 220;
          stroke-dashoffset: 220;
          animation:
            smartpunt-lightning-strike
            3.4s
            ease-out
            infinite;
        }

        .smartpunt-lightning-core {
          stroke: rgba(255, 255, 255, 0.98);
          stroke-width: 2.2;
        }

        .smartpunt-lightning-gold {
          stroke: rgba(232, 194, 72, 0.95);
          stroke-width: 4.8;
          opacity: 0.55;
        }

        .smartpunt-impact {
          background: radial-gradient(
            circle,
            rgba(255, 255, 255, 1) 0%,
            rgba(232, 194, 72, 0.95) 35%,
            rgba(0, 230, 145, 0.75) 65%,
            transparent 100%
          );

          animation:
            smartpunt-impact-flash
            3.4s
            ease-out
            infinite;

          box-shadow:
            0 0 8px rgba(255, 255, 255, 0.8),
            0 0 16px rgba(232, 194, 72, 0.45),
            0 0 20px rgba(0, 230, 145, 0.35);
        }

        .smartpunt-title-charge {
          mask-image: linear-gradient(
            to right,
            transparent 0%,
            black 8%,
            black 92%,
            transparent 100%
          );
          -webkit-mask-image: linear-gradient(
            to right,
            transparent 0%,
            black 8%,
            black 92%,
            transparent 100%
          );
        }

        .smartpunt-title-charge-sweep {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(232, 194, 72, 0.15) 10%,
            rgba(232, 194, 72, 0.95) 32%,
            rgba(255, 255, 255, 0.95) 50%,
            rgba(0, 230, 145, 0.95) 68%,
            rgba(0, 230, 145, 0.15) 90%,
            transparent 100%
          );

          animation:
            smartpunt-title-energise
            3.4s
            ease-out
            infinite;
        }

        .smartpunt-progress-energy {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(232, 194, 72, 0.95) 30%,
            rgba(255, 255, 255, 0.98) 50%,
            rgba(0, 230, 145, 0.95) 70%,
            transparent 100%
          );

          animation:
            smartpunt-progress-sweep
            2.4s
            ease-in-out
            infinite;

          will-change: transform, opacity;
        }

        @media (prefers-reduced-motion: reduce) {
          .smartpunt-lightning,
          .smartpunt-impact,
          .smartpunt-title-charge-sweep,
          .smartpunt-progress-energy {
            animation: none;
            opacity: 0;
          }
        }
      `}</style>
    </main>
  );
}
