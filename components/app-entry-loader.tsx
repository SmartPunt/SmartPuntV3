"use client";

import { useEffect, useRef, useState } from "react";

export default function AppEntryLoader({
  children,
}: {
  children: React.ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [showIntro, setShowIntro] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
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
  }, []);

  // ✅ fallback — now longer than your 6s video
  useEffect(() => {
    const fallback = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => setShowIntro(false), 400);
    }, 7000); // 🔥 was 4500 → now 7000

    return () => clearTimeout(fallback);
  }, []);

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
            className="
              w-[115vw]
              sm:w-[95vw]
              max-w-none
              sm:max-w-[600px]
              md:max-w-[750px]
              lg:max-w-[900px]
            "
          >
            <source src="/logo-animated.mp4" type="video/mp4" />
          </video>
        ) : (
          <img
            src="/header-logo.png"
            alt="SmartPunt"
            className="
              w-[115vw]
              sm:w-[95vw]
              max-w-none
              sm:max-w-[600px]
              md:max-w-[750px]
              lg:max-w-[900px]
            "
          />
        )}
      </div>
    </>
  );
}
