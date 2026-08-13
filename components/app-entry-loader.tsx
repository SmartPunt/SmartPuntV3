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
const [vaultFadeOut, setVaultFadeOut] = useState(false);

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
  setVaultFadeOut(false);

  const holdTimer = window.setTimeout(() => {
    setVaultFadeOut(true);
  }, minimumDisplayMs);

  const removeTimer = window.setTimeout(() => {
    setShowVaultIntro(false);
  }, minimumDisplayMs + 500);

  return () => {
    window.clearTimeout(holdTimer);
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

              @media (prefers-reduced-motion: reduce) {
                .vault-entry-wheel,
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

            <div className="vault-entry-glow pointer-events-none absolute left-1/2 top-[39.5%] h-[44%] w-[88%] rounded-full bg-amber-400/10 blur-[55px]" />

            <div className="pointer-events-none absolute left-1/2 top-[39.5%] aspect-square w-[78%] -translate-x-1/2 -translate-y-1/2">
              <img
                src="/vault/vault-wheel-handles.png"
                alt=""
                aria-hidden="true"
                className="vault-entry-wheel h-full w-full object-contain drop-shadow-[0_0_22px_rgba(251,191,36,0.24)]"
              />
            </div>

            <div className="pointer-events-none absolute left-1/2 top-[39.5%] aspect-[350/455] w-[39%] -translate-x-1/2 -translate-y-1/2">
              <img
                src="/vault/vault-shield.png"
                alt="The Vault"
                className="h-full w-full object-contain drop-shadow-[0_0_18px_rgba(251,191,36,0.22)]"
              />
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
