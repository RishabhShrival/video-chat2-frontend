// app/videochat/page.tsx or wherever your main page lives
"use client";

import { use, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import SimplePeer, { Instance as SimplePeerInstance, SignalData } from "simple-peer";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import VideoPlayer from "../components/VideoPlayer" // Adjust the import path as necessary

const socket = io(process.env.NEXT_PUBLIC_BACKEND_URL!, { autoConnect: true });

export default function VideoChat() {
  const router = useRouter(); //for page change
  const [users, setUsers] = useState<string[]>([]);  //usernames of connected peers 
  const [myId, setMyId] = useState<string | null>(null); //current user Id
  const [username, setUsername] = useState<string | null>(null);  //current user name
  const [roomId, setRoomId] = useState<string>(""); //current room Id
  const [error, setError] = useState<string | null>(null);  //error message if any
  const [remoteStreams, setRemoteStreams] = useState<{ peerId: string; stream: MediaStream }[]>([]);  //remote video streams from other users
  const localVideoRef = useRef<HTMLVideoElement | null>(null);  //reference to local video element
  const peersRef = useRef<{ [key: string]: SimplePeerInstance }>({}); //reference to all connected peers
  // This will hold the SimplePeer instances for each connected user
  const localStreamRef = useRef<MediaStream | null>(null); // reference to local media stream
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const qualitySettings = {
    low: { width: 320, height: 240, frameRate: 10 },
    medium: { width: 640, height: 480, frameRate: 20 },
    high: { width: 1280, height: 720, frameRate: 30 },
  }; // Define quality settings for video streams
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null); // Reference to the stats monitoring interval
  const [peerQualities, setPeerQualities] = useState<{ [peerId: string]: keyof typeof qualitySettings }>({}); // Track the quality of each peer's stream

  const getRTCPeerConnection = (peer: SimplePeerInstance): RTCPeerConnection | null => {
    return (peer as any)._pc ?? null;
  }; // Get the underlying RTCPeerConnection for network statistics

  const monitorStats = (onQualityUpdate: (peerId: string, quality: keyof typeof qualitySettings) => void) => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
  statsIntervalRef.current = setInterval(() => {
    Object.entries(peersRef.current).forEach(([peerId, peer]) => {
      const pc = getRTCPeerConnection(peer);
      if (!pc) return;

      pc.getStats(null).then((stats) => {
        let sendBitrate = 0;
        let recvBitrate = 0;

        stats.forEach((report) => {
          if (report.type === "outbound-rtp" && report.kind === "video") {
            sendBitrate = report.bitrateMean || 0;
          }
          if (report.type === "inbound-rtp" && report.kind === "video") {
            recvBitrate = report.bitrateMean || 0;
          }
        });

        const minBitrateKbps = Math.floor(Math.min(sendBitrate, recvBitrate) / 1000);

        let quality: keyof typeof qualitySettings = "low";
        if (minBitrateKbps > 1500) quality = "high";
        else if (minBitrateKbps > 700) quality = "medium";

        if (onQualityUpdate) onQualityUpdate(peerId, quality);

        // updatePeerVideoTrack(peer, quality).catch((err) => {
        //   console.error(`Failed to update video track for peer ${peerId}:`, err);});
        console.log(`Peer ${peerId} min bitrate: ${minBitrateKbps} kbps → ${quality}`);
      });
    });
  }, 5000);
  }; //check network statistics every 5 seconds using getStats()

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

    if (username) {
      socket.emit("register-username", username);
    }

    socket.on("signal", ({ from, signal }: { from: string; signal: SignalData }) => {
      if (!peersRef.current[from]) {
        const peer = createPeer(false, from);
        peersRef.current[from] = peer;
      }
      peersRef.current[from].signal(signal);
    });

    socket.on("all-users", (userList: string[]) => {
      userList.forEach((userId) => {
        startCall(userId);
      });
    });

    socket.on("user-list", (userList: string[]) => {
      monitorStats((peerId, quality) => {
        setPeerQualities((prev) => ({ ...prev, [peerId]: quality }));
      });
      setUsers(userList.filter((id) => id !== socket.id));
    });

    socket.on("room-id", (roomId: string) => {
      setRoomId(roomId);
    });

    socket.on("error", (message: string) => {
      setError(message);
    });

    socket.on("user-left", (peerId: string) => {
      if (peersRef.current[peerId]) {
        peersRef.current[peerId].destroy();
        delete peersRef.current[peerId];
      }
      setRemoteStreams((prev) => prev.filter((entry) => entry.peerId !== peerId));
      setUsers((prev) => prev.filter((id) => id !== peerId));
    });

    // Proper cleanup for monitorStats and socket events
    return () => {
      socket.off("connect");
      socket.off("signal");
      socket.off("user-list");
      socket.off("room-id");
      socket.off("error");
      socket.off("user-left");
    };
  }, []);


  const createPeer = (initiator: boolean, peerId: string) => {
    const peer = new SimplePeer({ initiator, stream: localStreamRef.current ?? undefined, trickle: false });
    console.log(`Creating peer ${initiator ? "initiator" : "receiver"} for ${peerId}`);

    peer.on("signal", (data: SignalData) => {
      socket.emit("signal", { to: peerId, signal: data });
    });

    // // For compatibility with newer WebRTC, listen for 'track' event
    // peer.on("track", (track, stream) => {
    //   setRemoteStreams((prev) => {
    //     if (prev.some((entry) => entry.peerId === peerId)) return prev;
    //     return [...prev, { peerId, stream }];
    //   });
    // });

    // Keep 'stream' event for backward compatibility
    peer.on("stream", (remoteStream: MediaStream) => {
      setRemoteStreams((prev) => {
        if (prev.some((entry) => entry.peerId === peerId)) return prev;
        return [...prev, { peerId, stream: remoteStream }];
      });
    });

    peer.on("close", () => {
      setRemoteStreams((prev) => prev.filter((entry) => entry.peerId !== peerId));
      delete peersRef.current[peerId];
    });

    return peer;
  };

  const startCall = (peerId: string) => {
    const peer = createPeer(true, peerId);
    peersRef.current[peerId] = peer;
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

  const cleanupCall = () => {
    //localStreamRef.current?.getTracks().forEach((track) => track.stop());
    socket.emit("disconnect");
    Object.values(peersRef.current).forEach((peer) => peer.destroy());
    peersRef.current = {};

    setRemoteStreams([]);
    setUsers([]);
    setRoomId("");
  };

  const updatePeerVideoTrack = async (peer: SimplePeerInstance, quality: keyof typeof qualitySettings) => {
    const pc = getRTCPeerConnection(peer);
    if (!pc) return;
    const constraints = { video: qualitySettings[quality], audio: true };
    try {
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return;
      // Replace the track in the local stream ref (for local preview)
      const oldStream = localStreamRef.current;
      if (oldStream) {
        const oldVideoTrack = oldStream.getVideoTracks()[0];
        if (oldVideoTrack) oldStream.removeTrack(oldVideoTrack);
        // Prevent duplicate tracks
        if (!oldStream.getVideoTracks().some(track => track.id === newVideoTrack.id)) {
          oldStream.addTrack(newVideoTrack);
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = oldStream;
      }
      // Replace the track for the peer connection
      const sender = pc.getSenders().find(s => s.track && s.track.kind === "video");
      if (sender) await sender.replaceTrack(newVideoTrack);
    } catch (err) {
      console.error("Failed to update video track:", err);
    }
  };

const toggleCamera = () => {
  const stream = localStreamRef.current;
  if (stream) {
    stream.getVideoTracks().forEach(track => {
      track.enabled = !cameraOn;
    });
    setCameraOn(prev => !prev);
  }
};

const toggleMic = () => {
  const stream = localStreamRef.current;
  if (stream) {
    stream.getAudioTracks().forEach(track => {
      track.enabled = !micOn;
    });
    setMicOn(prev => !prev);
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
          {roomId && (
            <div style={{ marginTop: "10px" }}>
              <button onClick={cleanupCall}>Leave Room</button>
            </div>
          )}
        </div>

        {/* Toggle Camera and Mic Buttons */}
        <div style={{ marginTop: "10px" }}>
          <button onClick={toggleCamera}>
            {cameraOn ? "Turn Camera Off" : "Turn Camera On"}
          </button>
          <button onClick={toggleMic} style={{ marginLeft: "10px" }}>
            {micOn ? "Mute Mic" : "Unmute Mic"}
          </button>
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "10px"
      }}>
        {/* Local video */}
        <video ref={localVideoRef} autoPlay muted style={{ width: "100%", borderRadius: "10px" }} />

        {/* Remote videos */}
        {remoteStreams.map(({ peerId, stream }) => (
          <VideoPlayer key={peerId} stream={stream} />
        ))}
      </div>
    </div>
  );
}