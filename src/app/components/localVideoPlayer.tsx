// components/VideoPlayer.tsx
"use client";

import React, { useEffect, useRef } from "react";

type Props = {
  stream: MediaStream | null;
  cameraOn?: boolean;
  totalUsers?: number;
};

export default function LocalVideoPlayer({ stream, cameraOn = true, totalUsers = 1 }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Determine layout styles based on totalUsers
  const layoutStyles =
    totalUsers === -1 // not in call
      ? "fixed w-1/2 lg:w-1/4 aspect-auto bottom-30 md:bottom-0 right-0": //default (corner)
    totalUsers === 0 // in call but no users
      ? "relative w-fit h-fit aspect-auto flex items-center justify-center !m-auto" : // Full size, centered
      totalUsers === 1 // one user in call
      ? "fixed w-1/2 lg:w-1/4 aspect-auto bottom-30 md:bottom-0 right-0": //default (corner)
      totalUsers === 2 // two users in call
      ? "fixed w-1/3 lg:w-1/5 aspect-auto bottom-20 md:bottom-0 right-0"  //default (corner)
      : ""; // Default (corner)

  return (
    totalUsers > 2 ? null : (
      <div
        className={`${layoutStyles} rounded-lg m-2 lg:m-10 shadow-2xl outline-2 dark:outline-white transition-[width,height] duration-500 ease-in-out`}
      >
        <div className="w-full h-full flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover rounded-lg bg-black"
          />
        </div>
        {!cameraOn && (
          <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-70 text-white flex items-center justify-center rounded-lg">
            Camera Off
          </div>
        )}
      </div>
    )
  );
}
