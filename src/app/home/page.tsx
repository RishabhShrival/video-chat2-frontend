"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import SimplePeer, { Instance as SimplePeerInstance, SignalData } from "simple-peer";

const socket = io(process.env.NEXT_PUBLIC_BACKEND_URL ,{autoConnect: true});

export default function VideoChat() {
  const [users, setUsers] = useState<string[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const peersRef = useRef<{ [key: string]: SimplePeerInstance }>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Get user media
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch((err) => console.error("Media access error:", err));

    // Handle socket connection
    socket.on("connect", () => {
      if (socket.id) {
        setMyId(socket.id);
      }
    });

    // Update user list
    socket.on("user-list", (userList: string[]) => {
      setUsers(userList.filter((id) => id !== socket.id));
    });

    // Handle incoming signals
    socket.on("signal", ({ from, signal }: { from: string; signal: SignalData }) => {
      if (!peersRef.current[from]) {
        const peer = createPeer(false, from);
        peersRef.current[from] = peer;
      }
      peersRef.current[from].signal(signal);
    });

    return () => {
      socket.off("connect");
      socket.off("user-list");
      socket.off("signal");
    };
  }, []);

  const createPeer = (initiator: boolean, peerId: string) => {
    const peer = new SimplePeer({ initiator, stream: localStreamRef.current ?? undefined, trickle: false });

    peer.on("signal", (data: SignalData) => {
      socket.emit("signal", { to: peerId, signal: data });
    });

    peer.on("stream", (remoteStream: MediaStream) => {
      addRemoteStream(peerId, remoteStream);
    });

    return peer;
  };

  const startCall = (peerId: string) => {
    const peer = createPeer(true, peerId);
    peersRef.current[peerId] = peer;
  };

  const addRemoteStream = (peerId: string, stream: MediaStream) => {
    if (!document.getElementById(peerId) && videoContainerRef.current) {
      const remoteVideo = document.createElement("video");
      remoteVideo.id = peerId;
      remoteVideo.srcObject = stream;
      remoteVideo.autoplay = true;
      videoContainerRef.current.appendChild(remoteVideo);
    }
  };

  return (
    <div>
      <h1>Multi-User Video Chat</h1>
      <div ref={videoContainerRef}>
        <video ref={localVideoRef} autoPlay muted />
      </div>
      <h2>Connected Users:</h2>
      <ul>
        {users.map((user) => (
          <li key={user}>
            {user} <button onClick={() => startCall(user)}>Call</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
