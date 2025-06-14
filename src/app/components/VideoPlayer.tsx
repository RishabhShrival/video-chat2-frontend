// components/VideoPlayer.tsx
"use client";

import React, { useEffect, useRef } from "react";

type Props = {
  stream: MediaStream;
  cameraOn?: boolean;
  micOn?: boolean;
  username?: string;
};

export default function VideoPlayer({ stream, cameraOn = true, micOn = true, username }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={{ position: "relative" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: "100%", borderRadius: "10px", background: "#000" }}
      />
      {!cameraOn && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.7)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            zIndex: 2,
            borderRadius: "10px"
          }}
        >
          Camera Off
        </div>
      )}
      {username && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            color: "#fff",
            background: "rgba(0,0,0,0.5)",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: 14,
            zIndex: 3
          }}
        >
          {username}
        </div>
      )}
    </div>
  );
}
