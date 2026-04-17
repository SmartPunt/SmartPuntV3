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
}: {
  children: React.ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [showIntro, setShowIntro] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [useDesktopCover, setUseDesktopCover] = useState(false);
  const [isReady, setIsReady] = useState(false);

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
    const shouldPlayIntro = getCookie("smartpunt_play_intro") === "true";

    if (shouldPlayIntro) {
      clearCookie("smartpunt_play_intro");
    }

    setShowIntro(shouldPlayIntro);
    setIsReady(true);
  }, []);

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

  if (!isReady || !showIntro) {
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
