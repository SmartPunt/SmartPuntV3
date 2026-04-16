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

  useEffect(() => {
    const fallback = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => setShowIntro(false), 400);
    }, 7000);

    return () => clearTimeout(fallback);
  }, []);

  if (!showIntro) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="min-h-screen">{children}</div>

      <div
        className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-500 ${
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
              /* 📱 Mobile */
              w-[115vw] h-auto object-contain
              
              /* 💻 Desktop safe default (no crop) */
              sm:w-[90vw] sm:h-auto sm:object-contain
              
              /* 🖥️ Only go cinematic on very tall screens */
              xl:w-full xl:h-full xl:object-cover
            "
          >
            <source src="/logo-animated.mp4" type="video/mp4" />
          </video>
        ) : (
          <img
            src="/header-logo.png"
            alt="SmartPunt"
            className="
              w-[115vw] h-auto object-contain
              sm:w-[90vw] sm:h-auto sm:object-contain
              xl:w-full xl:h-full xl:object-cover
            "
          />
        )}
      </div>
    </>
  );
}
