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
  // CHANGE: useState instead of useRef for users
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [username, setUsername] = useState<string | null>(null); //current user username
  const [roomId, setRoomId] = useState<string>(""); //current room Id
  const [error, setError] = useState<string | null>(null);  //error message if any
  const [remoteStreams, setRemoteStreams] = useState<{ peerId: string; stream: MediaStream }[]>([]);  //remote video streams from other users
  const localVideoRef = useRef<HTMLVideoElement | null>(null);  //reference to local video element
  const peersRef = useRef<{ [key: string]: SimplePeerInstance }>({}); //reference to all connected peers
  const localStreamRef = useRef<MediaStream | null>(null); // reference to local media stream
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const qualitySettings = {
    low: { width: 320, height: 240, frameRate: 10 },
    medium: { width: 640, height: 480, frameRate: 20 },
    high: { width: 1280, height: 720, frameRate: 30 },
  }; // Define quality settings for video streams

  useEffect(() => {
    if (username) {
      socket.emit("register-username", username);
    }
  }, [username]); // Register the username with the server when it changes

  // get local video stream
  const getLocalStream = (
    constraints: MediaStreamConstraints = { video: qualitySettings.medium, audio: true }
  ) => {
    return navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        return stream;
      })
      .catch((err) => {
        console.error("Media access error:", err);
        throw err;
      });
  }

  useEffect(() => {

    // get media stream 
    getLocalStream();

    //get username and auth
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (user) {
        setUsername(user.email ? user.email.split("@")[0] : null);
      } else {
        router.push("/");
      }
    });
    
    // socket event listeners (by default)
    socket.on("connect", () => {
      console.log("Connected to server with ID:", socket.id);
  
    });

    // Handle incoming signaling data from other peers (by default, can't be removed or altered)
    socket.on("signal", ({ from, signal }: { from: string; signal: SignalData }) => {
      if (peersRef.current[from]) {
        peersRef.current[from].signal(signal);
      }
    });


    // socket listen room-id when room is created
    socket.on("room-id", (roomId: string) => {
      setRoomId(roomId);
    });

    // Handle when a new user joins the room
    socket.on("user-joined", ({ id, username }: { id: string; username: string }) => {
      console.log(`User joined: ${username} (${id})`);
      startCall(id, false);
      setUsers(prev => prev.some(u => u.id === id) ? prev : [...prev, { id, username }]);
      //handleUserList(); // Refresh user list after someone joins
    });

    // Handle when the user joins a room
    socket.on("room-joined", ({ roomId, users: joinedUsers }: { roomId: string; users: { id: string; username: string }[] }) => {
      console.log(`Joined room: ${roomId}`);
      setUsers(joinedUsers);
      joinedUsers.forEach(user => {
        if (user.id !== socket.id) {
          startCall(user.id, true);
        }
      });
    });

    socket.on("user-list", (userList: { id: string; username: string }[]) => {
      setUsers(userList);
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
        setUsers(prev => prev.filter((user) => user.id !== peerId));
        console.log(`User left: ${peerId}`);
      }
      setRemoteStreams((prev) => {
        const updated = prev.filter((entry) => entry.peerId !== peerId);
        console.log("Remote streams after leave:", updated.map(e => ({ peerId: e.peerId, id: e.stream.id })));
        return updated;
      });
      handleUserList(); // Refresh user list after someone leaves
    });

    // Proper cleanup for monitorStats and socket events
    return () => {
      socket.off("connect");
      socket.off("signal");
      socket.off("user-joined");
      socket.off("room-joined");
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

    // Keep 'stream' event for backward compatibility
    peer.on("stream", (remoteStream: MediaStream) => {
      setRemoteStreams((prev) => {
        if (prev.some((entry) => entry.peerId === peerId)) return prev;
        const updated = [...prev, { peerId, stream: remoteStream }];
        console.log("Remote streams after join (stream):", updated.map(e => ({ peerId: e.peerId, id: e.stream.id })));
        return updated;
      });
      console.log("Remote stream received:", remoteStream);
      console.log("Tracks:", remoteStream.getTracks());
    });

    peer.on("close", () => {
      setRemoteStreams((prev) => {
        const updated = prev.filter((entry) => entry.peerId !== peerId);
        console.log("Remote streams after peer close:", updated.map(e => ({ peerId: e.peerId, id: e.stream.id })));
        return updated;
      });
      delete peersRef.current[peerId];
      setUsers(prev => prev.filter((user) => user.id !== peerId));
    });

    peer.on("error", (err) => {
      console.error(`Peer error (${peerId}):`, err);
    });

    return peer;
  };

  const startCall = (peerId: string, initiator: boolean) => {
    if (!localStreamRef.current){
      console.error("Local stream not ready, cannot start call.");
      getLocalStream();
      return;
    } // Don't start if local stream not ready
    if (peerId === socket.id || peersRef.current[peerId]) return;
    const peer = createPeer(initiator, peerId);
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

  const handleUserList = () => {
    if (roomId.trim()){
      socket.emit("user-list", roomId.trim());
      setError(null);
    }
  };

  //leave room and cleanup
  const cleanupCall = () => {
    //do not remove local stream
    socket.emit("leave-room", roomId);
    Object.values(peersRef.current).forEach((peer) => peer.destroy());
    peersRef.current = {};

    setRemoteStreams([]);
    setUsers([]); // <-- update here
    setRoomId("");
  };


  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      if (cameraOn) {
        videoTracks.forEach(track => {
          track.stop();
          stream.removeTrack(track);
        });
      } else {
        getLocalStream({ video: qualitySettings.medium, audio: false })
          .then(newStream => {
            const newVideoTrack = newStream.getVideoTracks()[0];
            stream.addTrack(newVideoTrack);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          });
      }
      setCameraOn(prev => !prev);
    }
  };

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      if (micOn) {
        // Stop and remove all audio tracks to free the mic hardware
        audioTracks.forEach(track => {
          track.stop();
          stream.removeTrack(track);
        });
      } else {
        // Re-acquire audio and add to stream
        getLocalStream({ video: false, audio: true })
          .then(newStream => {
            const newAudioTrack = newStream.getAudioTracks()[0];
            if (newAudioTrack) {
              stream.addTrack(newAudioTrack);
            }
          });
      }
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

        Toggle Camera and Mic Buttons
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


//types of emit events
// 1. "connection" - When a new user connects (by default)
// 2. "register-username" (username) - Register a username for the socket
// 3. "create-room" - Create a new room
// 4. "join-room" (roomId) - Join an existing room
// 5. "disconnect" - When a user disconnects (by default)
// 6. "leave-room" (roomId) - Leave a room
// 7. "signal" ({ to, signal }) - Relay signaling data for peer connection
// 8. "user-list" (roomId) - Get the list of users in a room


//types of listen events
// 1. "room-id" (roomId)- Create a new room
// 2. "signal" ({ to, signal }) - Relay signaling data for peer connection
// 3. "user-joined" ({ id, username }) - Notify users in the room when a new user joins
// 4. "room-joined" ({ roomId, users[{id:,username:}] }) - Notify the user who joined about the room and its users
// 5. "user-left" (socketId) - Notify users in the room when a user leaves
// 6. "error" (message) - Send error messages to the user
// 7. "user-list" (userList) - Send the list of users in a room to the requesting user
