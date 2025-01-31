"use client";

import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebaseConfig";

const Home: React.FC = () => {
  const [username, setUsername] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [peerUsername, setPeerUsername] = useState<string | null>(null);
  const [noUsersAvailable, setNoUsersAvailable] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUsername(user.email?.split("@")[0] || "");
      } else {
        setUsername(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (username) {
      socketRef.current = new WebSocket("ws://localhost:3001");

      socketRef.current.onmessage = async (message: MessageEvent) => {
        const data = JSON.parse(message.data);

        switch (data.type) {
          case "pair":
            setPeerUsername(data.peer);
            await startCall();
            break;
          case "no-users":
            setNoUsersAvailable(true);
            break;
          case "offer":
            await handleOffer(data.offer, data.from);
            break;
          case "answer":
            await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(data.answer));
            break;
          case "ice-candidate":
            await peerConnection.current?.addIceCandidate(new RTCIceCandidate(data.candidate));
            break;
          default:
            console.log("Unknown message type:", data);
        }
      };

      return () => {
        socketRef.current?.close();
      };
    }
  }, [username]);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    });
  }, []);

  const startCall = async () => {
    peerConnection.current = new RTCPeerConnection();
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.send(JSON.stringify({
          type: "ice-candidate",
          target: peerUsername,
          candidate: event.candidate,
        }));
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stream.getTracks().forEach((track) => peerConnection.current?.addTrack(track, stream));

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);

    socketRef.current?.send(JSON.stringify({ type: "offer", target: peerUsername, offer }));
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit, from: string) => {
    setPeerUsername(from);
    peerConnection.current = new RTCPeerConnection();
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.send(JSON.stringify({
          type: "ice-candidate",
          target: from,
          candidate: event.candidate,
        }));
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stream.getTracks().forEach((track) => peerConnection.current?.addTrack(track, stream));

    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);

    socketRef.current?.send(JSON.stringify({ type: "answer", target: from, answer }));
  };

  const goLive = () => {
    setIsLive(true);
    setNoUsersAvailable(false);
    socketRef.current?.send(JSON.stringify({ type: "go-live", username }));
  };

  return (
    <div>
      <h1>P2P Video Chat</h1>
      {username ? <p>Username: {username}</p> : <p>Loading...</p>}
      <button onClick={goLive} disabled={isLive}>{isLive ? "Waiting for Connection..." : "Go Live"}</button>
      {noUsersAvailable && <p>No users available</p>}
      {peerUsername && <p>Connected to: {peerUsername}</p>}
      <video ref={videoRef} autoPlay playsInline muted style={{ width: "300px", backgroundColor: "black" }}></video>
    </div>
  );
};

export default Home;
