// components/VideoPlayer.tsx
"use client";

import React, { useEffect, useRef } from "react";
import micIconOff from '../images/icons/microphoneOff.png';
import CamIconOff from '../images/icons/cameraOff.png';

type Props = {
  stream: MediaStream | null;
  cameraOn?: boolean;
  micOn?: boolean;
  username?: string;
  muted?: boolean;
};

export default function VideoPlayer({ stream, cameraOn = true, micOn = true, username, muted = false }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="rounded-lg aspect-square overflow-hidden m-2 shadow-2xl outline-2 dark:outline-white flex items-center justify-center">
      <div className="h-full w-full flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="relative w-full h-full object-cover rounded-lg shadow-2xl"
      />
      {username && (
        <div
          className="absolute inline-block bottom-2 left-2 text-white bg-black bg-opacity-50 rounded px-2 py-1 text-sm"
        >
          {username}
        </div>
      )}
      </div>
      {!cameraOn && (
        <div
          className="absolute bg-black bg-opacity-70 flex items-center justify-center rounded-lg"
        >
          <img src={CamIconOff.src} alt="Camera Off" className="w-8 h-8" />
        </div>
      )}
      {!micOn && (
        <div
          className="absolute top-0 left-0"
        >
          <img src={micIconOff.src} alt="Mic Off" className="w-8 h-8" />
        </div>
      )}
      
    </div>
  );
}

// components/VideoPlayer.tsx );

