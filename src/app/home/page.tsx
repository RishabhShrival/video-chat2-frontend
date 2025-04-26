"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import SimplePeer, { Instance as SimplePeerInstance, SignalData } from "simple-peer";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";

const socket = io(process.env.NEXT_PUBLIC_BACKEND_URL, { autoConnect: true });

export default function VideoChat() {
  const router = useRouter();
  const [users, setUsers] = useState<string[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string>(""); // Track room creation/joining
  const [error, setError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const peersRef = useRef<{ [key: string]: SimplePeerInstance }>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (user) {
        setUsername(user.email ? user.email.split("@")[0] : null);
      } else {
        router.push("/");
      }
    });

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch((err) => console.error("Media access error:", err));

    socket.on("connect", () => {
      if (socket.id) {
        setMyId(socket.id);
      }
    });

    socket.on("signal", ({ from, signal }: { from: string; signal: SignalData }) => {
      if (!peersRef.current[from]) {
        const peer = createPeer(false, from);
        peersRef.current[from] = peer;
      }
      peersRef.current[from].signal(signal);
    });

    socket.on("user-list", (userList: string[]) => {
      setUsers(userList.filter((id) => id !== socket.id)); // Save other users in room
      userList.forEach((id) => {
        if (id !== socket.id && !peersRef.current[id]) {
          startCall(id);
        }
      });
    });

    socket.on("room-id", (roomId: string) => {
      setRoomId(roomId);
    });

    socket.on("error", (message: string) => {
      setError(message);
    });

    return () => {
      socket.off("connect");
      socket.off("signal");
      socket.off("user-list");
      socket.off("room-id");
      socket.off("error");
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

  const handleCreateRoom = () => {
    socket.emit("create-room");
    setError(null);
  };

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      socket.emit("join-room", roomId.trim());
      setError(null);
    } else {
      setError("Please enter a room ID to join.");
    }
  };

  return (
    <div>
      <h1>Multi-User Video Chat</h1>
      <h2>Logged in as: {username}</h2>

      <div style={{ marginBottom: "20px" }}>
        {error && <p style={{ color: "red" }}>{error}</p>}

        <div>
          <button onClick={handleCreateRoom}>Create Room</button>
        </div>

        <div style={{ marginTop: "10px" }}>
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={handleJoinRoom}>Join Room</button>
        </div>
      </div>

      <div ref={videoContainerRef}>
        <video ref={localVideoRef} autoPlay muted />
      </div>
    </div>
  );
}
