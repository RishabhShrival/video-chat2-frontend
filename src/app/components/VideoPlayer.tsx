// components/VideoPlayer.tsx
"use client";

import { useEffect, useRef } from "react";

type Props = {
  stream: MediaStream;
};

export default function VideoPlayer({ stream }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return <video ref={videoRef} autoPlay style={{ width: "100%", borderRadius: "10px" }} />;
}
