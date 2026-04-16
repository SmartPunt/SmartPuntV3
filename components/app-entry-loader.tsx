"use client";

import { useEffect, useState } from "react";

export default function AppEntryLoader({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showIntro, setShowIntro] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 1400);

    const timer = setTimeout(() => {
      setShowIntro(false);
    }, 1800);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(timer);
    };
  }, []);

  if (!showIntro) {
    return <>{children}</>;
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <video
        src="/logo-animated.mp4"
        autoPlay
        muted
        playsInline
        className="w-[260px] sm:w-[320px] lg:w-[420px]"
      />
    </div>
  );
}
