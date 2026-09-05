export default function Loading() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
      <div className="relative flex w-full items-center justify-center">
        <img
          src="/smartpunt-loading-screen.png"
          alt="SmartPunt loading"
          className="block h-[90vh] w-[90vw] object-contain"
        />
{/* Metallic sweep across the SmartPunt horse */}
<div
  aria-hidden="true"
  className="smartpunt-global-horse-window pointer-events-none absolute left-1/2 top-[18%] h-[38%] w-[68%] max-w-[520px] -translate-x-1/2 overflow-hidden"
>
  <div className="smartpunt-global-horse-sweep h-[150%] w-[14%]" />
</div>
        {/* Subtle metallic sweep across SMARTPUNT */}
        <div
          aria-hidden="true"
          className="smartpunt-global-title-window pointer-events-none absolute left-1/2 top-[57%] h-[8%] w-[74%] max-w-[560px] -translate-x-1/2 overflow-hidden"
        >
          <div className="smartpunt-global-title-sweep h-full w-[18%]" />
        </div>

        {/* Restrained gold → green loading movement */}
        <div
          aria-hidden="true"
          className="smartpunt-global-loading-window pointer-events-none absolute left-1/2 top-[69.2%] h-[3px] w-[58%] max-w-[440px] -translate-x-1/2 overflow-hidden"
        >
          <div className="smartpunt-global-loading-sweep h-full w-[24%]" />
        </div>
      </div>

      <style>{`
@keyframes smartpunt-global-horse-shimmer {
  0%,
  58% {
    transform: translate(-220%, -18%) rotate(18deg);
    opacity: 0;
  }

  62% {
    opacity: 0.15;
  }

  68% {
    opacity: 0.65;
  }

  78% {
    transform: translate(620%, -18%) rotate(18deg);
    opacity: 0.5;
  }

  82%,
  100% {
    opacity: 0;
  }
}

@keyframes smartpunt-global-title-shimmer {
          0%,
          68% {
            transform: translateX(-180%);
            opacity: 0;
          }

          72% {
            opacity: 0.55;
          }

          84% {
            transform: translateX(520%);
            opacity: 0.45;
          }

          88%,
          100% {
            opacity: 0;
          }
        }

        @keyframes smartpunt-global-loading-flow {
          0% {
            transform: translateX(-130%);
            opacity: 0;
          }

          15% {
            opacity: 0.8;
          }

          50% {
            opacity: 1;
          }

          85% {
            opacity: 0.8;
          }

          100% {
            transform: translateX(430%);
            opacity: 0;
          }
        }

.smartpunt-global-horse-window {
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0%,
    black 8%,
    black 92%,
    transparent 100%
  );

  mask-image: linear-gradient(
    to right,
    transparent 0%,
    black 8%,
    black 92%,
    transparent 100%
  );
}

.smartpunt-global-horse-sweep {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 220, 120, 0.08) 22%,
    rgba(255, 245, 200, 0.5) 45%,
    rgba(255, 255, 255, 0.78) 50%,
    rgba(255, 225, 135, 0.45) 58%,
    rgba(255, 210, 90, 0.06) 78%,
    transparent 100%
  );

  animation:
    smartpunt-global-horse-shimmer
    4.8s
    ease-in-out
    infinite;

  mix-blend-mode: screen;
  will-change: transform, opacity;
}

.smartpunt-global-title-window {
  -webkit-mask-image: linear-gradient(
            to right,
            transparent 0%,
            black 10%,
            black 90%,
            transparent 100%
          );

          mask-image: linear-gradient(
            to right,
            transparent 0%,
            black 10%,
            black 90%,
            transparent 100%
          );
        }

        .smartpunt-global-title-sweep {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 230, 150, 0.08) 20%,
            rgba(255, 255, 255, 0.45) 50%,
            rgba(255, 225, 120, 0.08) 80%,
            transparent 100%
          );

          animation:
            smartpunt-global-title-shimmer
            4.2s
            ease-in-out
            infinite;
        }

        .smartpunt-global-loading-sweep {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(218, 177, 58, 0.95) 28%,
            rgba(255, 255, 255, 0.95) 50%,
            rgba(0, 220, 135, 0.95) 72%,
            transparent 100%
          );

          animation:
            smartpunt-global-loading-flow
            2.6s
            ease-in-out
            infinite;

          will-change: transform, opacity;
        }

@media (prefers-reduced-motion: reduce) {
  .smartpunt-global-horse-sweep,
  .smartpunt-global-title-sweep,
  .smartpunt-global-loading-sweep {
    animation: none;
    opacity: 0;
  }
}
      `}</style>
    </main>
  );
}
