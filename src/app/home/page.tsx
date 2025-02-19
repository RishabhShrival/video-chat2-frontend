"use client";

import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { socket } from "@/app/socket";

const Home: React.FC = () => {
    const [username, setUsername] = useState<string | null>(null);
    const [users, setUsers] = useState<string[]>([]);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const localStreamRef = useRef<HTMLVideoElement | null>(null);
    const peerConnections = useRef<Record<string, RTCPeerConnection>>({});

    useEffect(() => {
        const getUserMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (localStreamRef.current) {
                    localStreamRef.current.srcObject = stream;
                }
            } catch (error) {
                console.error("Error accessing media devices:", error);
            }
        };

        getUserMedia();

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUsername(user.email?.split("@")[0] || "");
                socket.connect();
                socket.emit("register", user.uid);
            }
        });

        return () => {
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        const handleUserList = (userList: string[]) => {
            setUsers(userList.filter((id) => id !== username));
        };

        socket.on("user-list", handleUserList);

        return () => {
            socket.off("user-list", handleUserList);
        };
    }, [username]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
            remoteVideoRef.current.play().catch((e) => console.error("Play failed:", e));
        }
    }, [remoteVideoRef.current?.srcObject]);

    useEffect(() => {
        const handleIncomingCall = async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
            const peer = createPeerConnection(from);
            await peer.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);

            socket.emit("answer-call", { to: from, answer });
        };

        const handleCallAnswered = async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
            await peerConnections.current[from]?.setRemoteDescription(new RTCSessionDescription(answer));
        };

        const handleIceCandidate = ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
            peerConnections.current[from]?.addIceCandidate(new RTCIceCandidate(candidate));
        };

        socket.on("incoming-call", handleIncomingCall);
        socket.on("call-answered", handleCallAnswered);
        socket.on("ice-candidate", handleIceCandidate);

        return () => {
            socket.off("incoming-call", handleIncomingCall);
            socket.off("call-answered", handleCallAnswered);
            socket.off("ice-candidate", handleIceCandidate);
        };
    }, []);

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
            console.log("🚀 Remote track received:", event.streams);
            if (event.streams.length > 0 && remoteVideoRef.current) {
                const remoteStream = event.streams[0];

                if (!remoteVideoRef.current.srcObject) {
                    remoteVideoRef.current.srcObject = remoteStream;
                    console.log("✅ Remote video set:", remoteStream);
                }
            }
        };

        navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
            stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        });

        peerConnections.current[peerId] = peer;
        return peer;
    };

    const callUser = async (peerId: string) => {
        const peer = createPeerConnection(peerId);
        const stream = localStreamRef.current?.srcObject as MediaStream;

        if (stream) {
            stream.getTracks().forEach((track) => peer.addTrack(track, stream));
            console.log("📞 Calling user");
        } else {
            console.error("❌ No local stream found before calling.");
        }

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
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    style={{
                        width: "400px",
                        height: "300px",
                        backgroundColor: "black",
                        display: "block",
                        visibility: "visible",
                    }}
                />
                <button onClick={() => remoteVideoRef.current?.play()}>Play Remote Video</button>
            </div>
        </div>
    );
};

export default Home;
