// components/VideoPlayer.tsx
"use client";

import React, { useEffect, useRef } from "react";

type Props = {
  stream: MediaStream | null;
  cameraOn?: boolean;
};

export default function LocalVideoPlayer({ stream, cameraOn = true}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="absolute bottom-0 right-0 lock min-w-50 w-1/6 rounded-lg overflow-hidden m-2 lg:m-10 shadow-2xl outline-2 dark:outline-white">
        
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full rounded-lg bg-black"
      />
      {!cameraOn && (
        <div
          className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-70 text-white flex items-center justify-center rounded-lg"
        >
          Camera Off
        </div>
      )}
    </div>
  );
}
