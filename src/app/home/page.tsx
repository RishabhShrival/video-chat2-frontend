"use client";

import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { socket } from "@/app/socket";

const peerConnections: Record<string, RTCPeerConnection> = {}; // Store peer connections

const Home: React.FC = () => {
  const [username, setUsername] = useState<string | null>(null);
  const [users, setUsers] = useState<string[]>([]);
  const [isLive, setIsLive] = useState(false);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUsername(user.email?.split("@")[0] || "");
        socket.connect();
        socket.emit("register", user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    socket.on("user-list", (userList: string[]) => {
      setUsers(userList.filter((id) => id !== username));
    });

    socket.on("incoming-call", async ({ from, offer }) => {
        const peer = createPeerConnection(from);
        await peer.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socket.emit("answer-call", { to: from, answer });
    });

    socket.on("call-answered", async ({ from, answer }) => {
        await peerConnections[from]?.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on("ice-candidate", ({ from, candidate }) => {
        peerConnections[from]?.addIceCandidate(new RTCIceCandidate(candidate));
    });

  }, [username]);

  const createPeerConnection = (peerId: string) => {
        const peer = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice-candidate", { to: peerId, candidate: event.candidate });
            }
        };

        peer.ontrack = (event) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
            if (localStreamRef.current) {
                localStreamRef.current.srcObject = stream;
            }
            stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        });

        peerConnections[peerId] = peer;
        return peer;
    };
    const callUser = async (peerId: string) => {
        const peer = createPeerConnection(peerId);
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        socket.emit("call-user", { to: peerId, offer });
    };

    return (
        <div>
            <h1>Online Users</h1>
            <ul>
                {users.map((user) => (
                    <li key={user}>
                        {user} <button onClick={() => callUser(user)}>Call</button>
                    </li>
                ))}
            </ul>
            <div>
                <video ref={localStreamRef} autoPlay playsInline muted />
                <video ref={remoteVideoRef} autoPlay playsInline />
            </div>
        </div>
    );

}