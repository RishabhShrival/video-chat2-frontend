"use client";

import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebaseConfig";

const Home: React.FC = () => {
  const [username, setUsername] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Waiting for connection...");
  const socketRef = useRef<WebSocket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUsername(user.email?.split("@")[0] || "");
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (username) {
      socketRef.current = new WebSocket("wss://video-chat2-4v77.onrender.com");

      socketRef.current.onmessage = async (message: MessageEvent) => {
        const data = JSON.parse(message.data);
        switch (data.type) {
          case "connect-peer":
            await startCall(data.username);
            break;
          case "offer":
            await handleOffer(data.offer, data.from);
            break;
          case "answer":
            await handleAnswer(data.answer);
            break;
          case "ice-candidate":
            if (peerRef.current) {
              await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
            break;
          case "no-user-available":
            setStatusMessage("No users available.");
            break;
          default:
            console.log("Unknown message type:", data);
        }
      };
    }
  }, [username]);

  const getMediaStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      return stream;
    } catch (error) {
      console.error("Error accessing camera/microphone:", error);
      setStatusMessage("Camera access denied. Please allow camera and refresh.");
      return null;
    }
  };

  const startCall = async (partner: string) => {
    const stream = await getMediaStream();
    if (!stream) return;

    peerRef.current = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peerRef.current.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate, target: partner }));
      }
    };
    peerRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    stream.getTracks().forEach((track) => peerRef.current!.addTrack(track, stream));

    const offer = await peerRef.current.createOffer();
    await peerRef.current.setLocalDescription(offer);
    if (socketRef.current) {
      socketRef.current.send(JSON.stringify({ type: "offer", offer, target: partner }));
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit, from: string) => {
    const stream = await getMediaStream();
    if (!stream) return;

    peerRef.current = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peerRef.current.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate, target: from }));
      }
    };
    peerRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    stream.getTracks().forEach((track) => peerRef.current!.addTrack(track, stream));

    await peerRef.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerRef.current.createAnswer();
    await peerRef.current.setLocalDescription(answer);
    if (socketRef.current) {
      socketRef.current.send(JSON.stringify({ type: "answer", answer, target: from }));
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (peerRef.current) {
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const toggleGoLive = async () => {
    setIsLive((prev) => !prev);
    if (socketRef.current && username) {
      socketRef.current.send(JSON.stringify({ type: "go-live", username }));
      setStatusMessage("Waiting for connection...");
      await getMediaStream(); // Ensure media is available before a call starts
    }
  };

  return (
    <div>
      <h1>Video Chat</h1>
      {username ? <p>Username: {username}</p> : <p>Loading...</p>}
      <button onClick={toggleGoLive} style={{ backgroundColor: isLive ? "green" : "gray" }}>
        {isLive ? "Go Live (Active)" : "Go Live"}
      </button>
      <p>{statusMessage}</p>
      <div style={{ display: "flex", gap: "10px" }}>
        <video ref={videoRef} autoPlay muted style={{ width: "300px", height: "300px", backgroundColor: "black" }}></video>
        <video ref={remoteVideoRef} autoPlay style={{ width: "300px", height: "300px", backgroundColor: "black" }}></video>
      </div>
    </div>
  );
};

export default Home;
