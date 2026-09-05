export default function Loading() {
  return (
    <main className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-black">
      <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden">
        {/* Main Live Picks artwork */}
        <img
          src="/smartpunt-live-picks-loading.png"
          alt="SmartPunt Live Picks loading"
          className="block max-h-[100dvh] w-full max-w-[768px] object-contain"
        />

        {/*
          Real lightning footage.

          Screen blending removes the crushed black background and leaves
          predominantly the natural lightning visible over the artwork.
        */}
        <div
          aria-hidden="true"
className="smartpunt-lightning-window pointer-events-none absolute left-1/2 top-0 h-full w-full max-w-[768px] -translate-x-1/2 overflow-hidden"
        >
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
className="smartpunt-lightning-video h-full w-full object-cover [transform:translateZ(0)]"
          >
            <source
              src="/smartpunt-lightning-strike.mp4"
              type="video/mp4"
            />
          </video>
        </div>

        {/* Small impact response where the strike reaches LIVE PICKS */}
        <div
          aria-hidden="true"
          className="smartpunt-impact pointer-events-none absolute left-1/2 top-[45%] h-2 w-2 -translate-x-1/2 rounded-full"
        />

        {/* Energy travelling across the LIVE PICKS plate after impact */}
        <div
          aria-hidden="true"
          className="smartpunt-title-window pointer-events-none absolute left-1/2 top-[40.5%] h-[10.5%] w-[78%] max-w-[600px] -translate-x-1/2 overflow-hidden"
        >
          <div className="smartpunt-title-energy h-full w-[22%]" />
        </div>

        {/* Continuous restrained movement across the artwork progress bar */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[61%] h-[2px] w-[68%] max-w-[520px] -translate-x-1/2 overflow-hidden opacity-80"
        >
          <div className="smartpunt-progress-energy h-full w-[28%]" />
        </div>
      </div>

      <style>{`
        /*
          Real lightning:
          - screen blend removes most of the dark footage
          - no CSS blur
          - no large WebKit compositing glow
        */

@keyframes smartpunt-real-lightning {
  0%,
  7% {
    opacity: 0;
  }

  8% {
    opacity: 0.85;
  }

  10% {
    opacity: 0.15;
  }

  12% {
    opacity: 1;
  }

  15% {
    opacity: 0.35;
  }

  18% {
    opacity: 0.9;
  }

  22% {
    opacity: 0;
  }

  100% {
    opacity: 0;
  }
}

.smartpunt-lightning-video {
  mix-blend-mode: screen;
  opacity: 0;

  animation:
    smartpunt-real-lightning
    5s
    linear
    infinite;
}

        @keyframes smartpunt-impact {
          0%,
          22%,
          100% {
            opacity: 0;
            transform: translateX(-50%) scale(0.4);
          }

          27% {
            opacity: 1;
            transform: translateX(-50%) scale(2);
          }

          32% {
            opacity: 0.55;
            transform: translateX(-50%) scale(1.15);
          }

          40% {
            opacity: 0;
            transform: translateX(-50%) scale(0.5);
          }
        }

        @keyframes smartpunt-title-charge {
          0%,
          24%,
          100% {
            transform: translateX(-150%);
            opacity: 0;
          }

          29% {
            opacity: 0.8;
          }

          46% {
            transform: translateX(440%);
            opacity: 0.7;
          }

          52% {
            opacity: 0;
          }
        }

        @keyframes smartpunt-progress {
          0% {
            transform: translateX(-125%);
            opacity: 0;
          }

          15% {
            opacity: 0.85;
          }

          50% {
            opacity: 1;
          }

          85% {
            opacity: 0.85;
          }

          100% {
            transform: translateX(430%);
            opacity: 0;
          }
        }

        .smartpunt-impact {
          background: #ffffff;

box-shadow:
  0 0 4px rgba(255, 255, 255, 0.65),
  -4px 0 8px rgba(224, 183, 64, 0.3),
  4px 0 8px rgba(0, 220, 135, 0.28);

animation:
  smartpunt-impact
  5s
  ease-out
  infinite;
        }

        .smartpunt-title-window {
          -webkit-mask-image: linear-gradient(
            to right,
            transparent,
            black 8%,
            black 92%,
            transparent
          );

          mask-image: linear-gradient(
            to right,
            transparent,
            black 8%,
            black 92%,
            transparent
          );
        }

        .smartpunt-title-energy {
background: linear-gradient(
  90deg,
  transparent 0%,
  rgba(220, 180, 60, 0.05) 12%,
  rgba(232, 194, 72, 0.48) 34%,
  rgba(255, 255, 255, 0.65) 50%,
  rgba(0, 225, 140, 0.48) 66%,
  rgba(0, 225, 140, 0.05) 88%,
  transparent 100%
);

animation:
  smartpunt-title-charge
  5s
  ease-out
  infinite;
        }

        .smartpunt-progress-energy {
          background: linear-gradient(
            90deg,
            transparent,
            rgba(220, 180, 60, 0.9),
            rgba(255, 255, 255, 0.95),
            rgba(0, 225, 140, 0.9),
            transparent
          );

          animation:
            smartpunt-progress
            2.4s
            ease-in-out
            infinite;

          will-change: transform, opacity;
        }

        @media (prefers-reduced-motion: reduce) {
          .smartpunt-lightning-video {
            display: none;
          }

          .smartpunt-impact,
          .smartpunt-title-energy,
          .smartpunt-progress-energy {
            animation: none;
            opacity: 0;
          }
        }
      `}</style>
    </main>
  );
}
