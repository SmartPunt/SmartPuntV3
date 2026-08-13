"use client";

import { useEffect, useRef, useState } from "react";

function getCookie(name: string) {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;

  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export default function AppEntryLoader({
  children,
  vaultIntro = false,
  minimumDisplayMs = 2500,
}: {
  children: React.ReactNode;
  vaultIntro?: boolean;
  minimumDisplayMs?: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [showIntro, setShowIntro] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [useDesktopCover, setUseDesktopCover] = useState(false);
const [isReady, setIsReady] = useState(false);
const [showVaultIntro, setShowVaultIntro] = useState(false);
const [vaultOpening, setVaultOpening] = useState(false);
const [vaultFadeOut, setVaultFadeOut] = useState(false);
const [vaultProgress, setVaultProgress] = useState(0);

  useEffect(() => {
    function updateViewportMode() {
      const width = window.innerWidth;
      const height = window.innerHeight;

      const isPhone = width < 640;
      if (isPhone) {
        setUseDesktopCover(false);
        return;
      }

      const aspectRatio = width / height;
      const isWideDesktop = width >= 1400;
      const isTallEnough = height >= 800;
      const isNotSnappedStyle = aspectRatio >= 1.45;

      setUseDesktopCover(isWideDesktop && isTallEnough && isNotSnappedStyle);
    }

    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);

    return () => {
      window.removeEventListener("resize", updateViewportMode);
    };
  }, []);

  
useEffect(() => {
  const shouldPlayIntro = false;

  if (shouldPlayIntro) {
    clearCookie("smartpunt_play_intro");
  }

  setShowIntro(shouldPlayIntro);
  setIsReady(true);
}, []);
useEffect(() => {
  if (!vaultIntro) return;

  setShowVaultIntro(true);
  setVaultOpening(false);
  setVaultFadeOut(false);
  setVaultProgress(0);

  const startedAt = Date.now();

  const progressTimer = window.setInterval(() => {
    const elapsed = Date.now() - startedAt;

    const progress = Math.min(
      99,
      Math.floor((elapsed / minimumDisplayMs) * 100),
    );

    setVaultProgress(progress);
  }, 40);

  const openingTimer = window.setTimeout(() => {
    window.clearInterval(progressTimer);
    setVaultProgress(100);
    setVaultOpening(true);
  }, minimumDisplayMs);

  const fadeTimer = window.setTimeout(() => {
    setVaultFadeOut(true);
  }, minimumDisplayMs + 800);

  const removeTimer = window.setTimeout(() => {
    setShowVaultIntro(false);
  }, minimumDisplayMs + 1300);

  return () => {
    window.clearInterval(progressTimer);
    window.clearTimeout(openingTimer);
    window.clearTimeout(fadeTimer);
    window.clearTimeout(removeTimer);
  };
}, [minimumDisplayMs, vaultIntro]);
  useEffect(() => {
    if (!showIntro) return;

    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      setFadeOut(true);
      setTimeout(() => setShowIntro(false), 400);
    };

    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("ended", handleEnded);
    };
  }, [showIntro]);

  useEffect(() => {
    if (!showIntro) return;

    const fallback = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => setShowIntro(false), 400);
    }, 7000);

    return () => clearTimeout(fallback);
  }, [showIntro]);

  const mediaClassName = useDesktopCover
    ? "absolute inset-0 h-full w-full object-cover"
    : "w-[115vw] h-auto object-contain sm:w-[90vw] lg:w-[80vw]";

if (!isReady) {
  return <>{children}</>;
}

if (vaultIntro && showVaultIntro) {
  return (
    <>
      <div className="min-h-screen">{children}</div>

      <div
        className={`fixed inset-0 z-[9999] overflow-hidden bg-black transition-opacity duration-500 ${
          vaultFadeOut
            ? "pointer-events-none opacity-0"
            : "opacity-100"
        }`}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes vault-entry-wheel {
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

              @keyframes vault-entry-glow {
                0%, 100% {
                  opacity: 0.35;
                  transform: translate(-50%, -50%) scale(0.96);
                }

                50% {
                  opacity: 0.9;
                  transform: translate(-50%, -50%) scale(1.05);
                }
              }
@keyframes vault-door-open {
  0% {
    transform:
      perspective(900px)
      rotateY(0deg)
      translateX(0);
    opacity: 1;
  }

  25% {
    transform:
      perspective(900px)
      rotateY(-8deg)
      translateX(-2%);
    opacity: 1;
  }

  100% {
    transform:
      perspective(900px)
      rotateY(-78deg)
      translateX(-42%);
    opacity: 0.15;
  }
}

@keyframes vault-opening-light {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.55);
  }

  35% {
    opacity: 0.55;
  }

  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.45);
  }
}

@keyframes vault-background-release {
  0% {
    opacity: 1;
  }

  45% {
    opacity: 0.82;
  }

  100% {
    opacity: 0;
  }
}
              .vault-entry-wheel {
                animation:
                  vault-entry-wheel
                  2.7s
                  cubic-bezier(0.22, 1, 0.36, 1)
                  infinite
                  alternate;
                transform-origin: center;
              }

              .vault-entry-glow {
                animation:
                  vault-entry-glow
                  2.6s
                  ease-in-out
                  infinite;
              }
.vault-door-opening {
  animation:
    vault-door-open
    800ms
    cubic-bezier(0.22, 1, 0.36, 1)
    forwards !important;
  transform-origin: left center;
}

.vault-opening-light {
  animation:
    vault-opening-light
    800ms
    ease-out
    forwards;
}

.vault-background-release {
  animation:
    vault-background-release
    800ms
    ease-out
    forwards;
}
              @media (prefers-reduced-motion: reduce) {
                .vault-entry-wheel,
                .vault-door-opening,
.vault-opening-light,
.vault-background-release,
                .vault-entry-glow {
                  animation: none !important;
                }
              }
            `,
          }}
        />

        <div className="absolute inset-0 flex justify-center bg-black">
          <div className="relative h-full w-full max-w-[430px] overflow-hidden bg-black">
<img
  src="/vault/vault-loading-base.png"
  alt=""
  aria-hidden="true"
  className="absolute inset-0 h-full w-full object-cover"
/>
<div className="pointer-events-none absolute left-1/2 top-[39.5%] aspect-square w-[76%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-amber-300/20 bg-[radial-gradient(circle_at_center,rgba(120,53,15,0.32)_0%,rgba(24,24,27,0.99)_34%,rgba(3,3,3,1)_72%)] shadow-[inset_0_0_70px_rgba(0,0,0,0.98),0_0_38px_rgba(245,158,11,0.15)]">
  <div className="absolute inset-[8%] rounded-full bg-black shadow-[inset_0_0_50px_rgba(245,158,11,0.10)]" />
</div>
{vaultOpening ? (
  <div className="vault-opening-light pointer-events-none absolute left-1/2 top-[39.5%] h-[42%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(254,240,138,0.95)_0%,rgba(251,191,36,0.52)_28%,rgba(245,158,11,0.16)_55%,transparent_72%)] blur-[18px]" />
) : null}
            <div className="vault-entry-glow pointer-events-none absolute left-1/2 top-[39.5%] h-[44%] w-[88%] rounded-full bg-amber-400/10 blur-[55px]" />
<div className="pointer-events-none absolute left-1/2 top-[82.2%] flex aspect-square w-[23%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#050403]">
  <span className="bg-gradient-to-b from-amber-100 via-yellow-300 to-amber-500 bg-clip-text text-2xl font-black tabular-nums text-transparent">
    {vaultProgress}%
  </span>
</div>
<div className="pointer-events-none absolute left-1/2 top-[39.5%] aspect-square w-[76%] -translate-x-1/2 -translate-y-1/2">
  <div
    className={`h-full w-full ${
      vaultOpening
        ? "vault-door-opening"
        : "vault-entry-wheel"
    }`}
  >
    <img
      src="/vault/vault-complete-door.png"
      alt="The Vault"
      className="h-full w-full object-contain drop-shadow-[0_0_24px_rgba(251,191,36,0.28)]"
    />
  </div>
</div>
          </div>
        </div>
      </div>
    </>
  );
}

if (!showIntro) {
  return <>{children}</>;
}

  return (
    <>
      <div className="min-h-screen">{children}</div>

      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black transition-opacity duration-500 ${
          fadeOut ? "opacity-0" : "opacity-100"
        }`}
      >
        {!videoFailed ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            preload="auto"
            onError={() => setVideoFailed(true)}
            className={mediaClassName}
          >
            <source src="/logo-animated.mp4" type="video/mp4" />
          </video>
        ) : (
          <img
            src="/header-logo.png"
            alt="SmartPunt"
            className={mediaClassName}
          />
        )}
      </div>
    </>
  );
}
