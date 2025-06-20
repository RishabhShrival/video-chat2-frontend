// app/videochat/page.tsx or wherever your main page lives
"use client";

import CamIconOn from '../images/icons/cameraOn.png';
import CamIconOff from '../images/icons/cameraOff.png';
import micIconOn from '../images/icons/microphoneOn.png';
import micIconOff from '../images/icons/microphoneOff.png';
import leaveIcon from '../images/icons/leave.png';
import '../globals.css'; // Ensure global styles are imported
import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import SimplePeer, { Instance as SimplePeerInstance, SignalData } from "simple-peer";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {auth} from '../firebaseConfig';
import VideoPlayer from "../components/VideoPlayer" // remote video player component necessary
import LocalVideoPlayer from "../components/localVideoPlayer"; // local video player component
import RemoteStreamLayout from '../components/remoteStreamLayout';



const socket = io(process.env.NEXT_PUBLIC_BACKEND_URL!, { autoConnect: true });

export default function VideoChat() {
  const router = useRouter(); //for page change 
  // CHANGE: useState instead of useRef for users
  const [inCall, setInCall] = useState(false);
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [username, setUsername] = useState<string | null>(null); //current user username
  const [roomId, setRoomId] = useState<string>(""); //current room Id
  const [error, setError] = useState<string | null>(null);  //error message if any
  const [remoteStreams, setRemoteStreams] = useState<{ peerId: string; stream: MediaStream }[]>([]);  //remote video streams from other users
  const localVideoRef = useRef<HTMLVideoElement | null>(null);  //reference to local video element
  const peersRef = useRef<{ [key: string]: SimplePeerInstance }>({}); //reference to all connected peers
  const localStreamRef = useRef<MediaStream | null>(null); // reference to local media stream
  const [cameraOn, setCameraOn] = useState(true);  // local camera status
  const [micOn, setMicOn] = useState(true); //local mic status
  const [cameraBusy, setCameraBusy] = useState(false); // toggle state
  const [micBusy, setMicBusy] = useState(false); //toggle state
  const [remoteMediaStatus, setRemoteMediaStatus] = useState<{ [id: string]: { camera: boolean; mic: boolean } }>({
  });
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
  const getLocalStream = async (
    constraints: MediaStreamConstraints = { video: qualitySettings.medium, audio: true },
    updateRef: boolean = true // add this flag
  ) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (updateRef) {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }
      return stream;
    } catch (err) {
      console.error("Media access error:", err);
      throw err;
    }
  };

  useEffect(() => {

    // get media stream 
    getLocalStream();

    //get username and auth
    // const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (user) {
        const username = user.email ? user.email.split("@")[0] : null;
        setUsername(username);

        const storedRoomId = localStorage.getItem("roomId");
        if (storedRoomId) {
          setRoomId(storedRoomId);
          socket.emit("join-room", storedRoomId);
        }
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
      localStorage.setItem("roomId", roomId); // Save it
      setInCall(true);
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

    socket.on(
      "camera-mic-status",
      ({ id, camera, mic }: { id: string; camera: boolean; mic: boolean }) => {
        setRemoteMediaStatus(prev => ({
          ...prev,
          [id]: { camera, mic }
        }));
      }
    );

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
      socket.off("camera-mic-status");
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

  const startCall = async (peerId: string, initiator: boolean) => {
    if (peerId === socket.id || peersRef.current[peerId]) return;
  
    let stream = localStreamRef.current;
    if (!stream) {
      try {
        stream = await getLocalStream();
        localStreamRef.current = stream; // ensure it's updated globally too
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to get local stream for call:", err);
        return;
      }
    }
  
    const peer = createPeer(initiator, peerId);
    peersRef.current[peerId] = peer;
    setInCall(true);
  };
  

  const handleCreateRoom = () => {
    if (!socket.connected) {
      setError("Socket not connected. Please try again later.");
      return;
    }
  
    socket.emit("create-room", (response: { success: boolean; roomId?: string; error?: string }) => {
      if (response.success && response.roomId) {
        setRoomId(response.roomId);
        setError(null);
      } else {
        setError(response.error || "Failed to create room.");
      }
    });
  };
  


  const handleJoinRoom = () => {
    if (!roomId.trim()) {
      setError("Please enter a room ID to join.");
      return;
    }
  
    if (!socket.connected) {
      setError("Unable to connect to the server. Please try again later.");
      return;
    }
  
    try {
      socket.emit("join-room", roomId.trim(), (response: { success: boolean; error?: string }) => {
        if (response.success) {
          localStorage.setItem("roomId", roomId.trim()); // Save it
          setError(null);
          setInCall(true);
        } else {
          setError(response.error || "Failed to join the room. Please try again.");
        }
      });
    } catch (err) {
      console.error("Error joining room:", err);
      setError("An unexpected error occurred. Please try again.");
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
    localStorage.removeItem("roomId");
    setInCall(false);
    setError(null);
    setRemoteStreams([]);
    setUsers([]); // <-- update here
    setRoomId("");
  };


  const toggleCamera = async () => {
    if (cameraBusy) return;
    setCameraBusy(true);

    const stream = localStreamRef.current;
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      if (cameraOn) {
        videoTracks.forEach(track => {
          // Remove from all peers
          Object.values(peersRef.current).forEach(peer => {
            peer.removeTrack(track, stream);
          });
          track.stop();
          stream.removeTrack(track);
        });
      } else {
        try {
          const newStream = await getLocalStream({ video: qualitySettings.medium, audio: false }, false); // updateRef: false
          const newVideoTrack = newStream.getVideoTracks()[0];
          if (newVideoTrack) {
            stream.addTrack(newVideoTrack);
            Object.values(peersRef.current).forEach(peer => {
              const sender = (peer as any)._pc.getSenders().find(
                (s: RTCRtpSender) => s.track && s.track.kind === "video"
              );
              if (sender) {
                sender.replaceTrack(newVideoTrack);
              } else {
                peer.addTrack(newVideoTrack, stream);
              }
            });
          }
        } catch (err) {
          setError("Could not access camera.");
        }
      }
      setCameraOn(prev => !prev);
      // Notify others about camera status
      socket.emit("camera-mic-status", {
        roomId,
        id: socket.id,
        camera: !cameraOn,
        mic: micOn
      });
    }
    setTimeout(() => setCameraBusy(false), 500); // 1s cooldown
  };

  const toggleMic = async () => {
    if (micBusy) return;
    setMicBusy(true);
  
    const stream = localStreamRef.current;
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      if (micOn) {
        audioTracks.forEach(track => {
          Object.values(peersRef.current).forEach(peer => {
            peer.removeTrack(track, stream);
          });
          track.stop();
          stream.removeTrack(track);
        });
      } else {
        try {
          // Do NOT update localStreamRef or local video element here!
          const newStream = await getLocalStream({ video: false, audio: true }, false);
          const newAudioTrack = newStream.getAudioTracks()[0];
          if (newAudioTrack) {
            stream.addTrack(newAudioTrack);
            Object.values(peersRef.current).forEach(peer => {
              peer.addTrack(newAudioTrack, stream);
            });
          }
        } catch (err) {
          setError("Could not access microphone.");
        }
      }
      setMicOn(prev => !prev);
      socket.emit("camera-mic-status", {
        roomId,
        id: socket.id,
        camera: cameraOn,
        mic: !micOn
      });
    }
    setTimeout(() => setMicBusy(false), 500);
  };

  return (
    <div className="flex flex-col w-full h-full p-5 bg-gray-900 dark:bg-gray-800">
    {/* Heading Box */}
    <div className="flex flex-col p-4 text-2xl items-center justify-center w-full text-gray-800 dark:text-gray-200 bg-amber-900 bg-opacity-80 rounded-lg shadow-md">
      <div className="font-bold">Start Call</div>
      <div className="italic">Welcome, {username}</div>
    </div>

    {/* Input Box */}
    {inCall ? null : (
      <div className="flex flex-col items-center justify-center w-full m-auto p-10 bg-amber-400 bg-opacity-80 rounded-lg shadow-md">
        <div className="w-full max-w-md">
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="w-full bg-white text-lg text-gray-800 px-4 py-2 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
          <button
            onClick={handleJoinRoom}
            className="w-full mt-4 bg-blue-500 text-white px-5 py-2 text-lg rounded-lg shadow-md hover:bg-blue-600 active:bg-blue-700 transition-all"
          >
            Join Room
          </button>
        </div>

        <div className="my-5 text-gray-700 dark:text-gray-300 font-medium">Or</div>

        <div className="w-full max-w-md">
          <button
            onClick={handleCreateRoom}
            className="w-full bg-green-600 text-white px-5 py-2 text-lg rounded-lg shadow-md hover:bg-green-700 active:bg-green-800 transition-all"
          >
            Create Room
          </button>
        </div>
      </div>
    )}

    {/* Toggle Camera and Mic Buttons */}
    <div className="flex fixed bottom-0 justify-center w-full z-10 py-4">
      <button
        onClick={toggleCamera}
        disabled={cameraBusy}
        className="w-16 h-16 rounded-full bg-gray-500 text-white flex items-center justify-center shadow-md hover:bg-gray-600 active:bg-gray-700 transition-all m-2 disabled:opacity-50"
      >
        {cameraOn ? <img src={CamIconOn.src} alt="Camera On" /> : <img src={CamIconOff.src} alt="Camera Off" />}
      </button>

      {inCall && (
        <button
          onClick={cleanupCall}
          className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 active:bg-red-700 transition-all m-2"
        >
          <img src={leaveIcon.src} alt="Leave Call" />
        </button>
      )}

      {inCall && (
        <button
          onClick={toggleMic}
          disabled={micBusy}
          className="w-16 h-16 rounded-full bg-gray-500 text-white flex items-center justify-center shadow-md hover:bg-gray-600 active:bg-gray-700 transition-all m-2 disabled:opacity-50"
        >
          {micOn ? <img src={micIconOn.src} alt="Mic On" /> : <img src={micIconOff.src} alt="Mic Off" />}
        </button>
      )}
    </div>

    {/* Local Video */}
    <LocalVideoPlayer stream={localStreamRef.current} cameraOn={cameraOn} />

    {/* Remote Videos */}
    {/* <RemoteStreamLayout remoteStreams={remoteStreams} remoteMediaStatus={remoteMediaStatus} /> */}
    <div className="flex flex-wrap justify-center gap-4 p-4">
      {remoteStreams.map(({ peerId, stream }) => (
        <div key={peerId} className="relative w-1/3 h-64">
          <VideoPlayer
            stream={stream}
            cameraOn={remoteMediaStatus[peerId]?.camera ?? true}
            micOn={remoteMediaStatus[peerId]?.mic ?? true}
            username={users.find(user => user.id === peerId)?.username || peerId}
          />
        </div>
      ))}
      </div>

    {/* Error Box */}
    <div className="mt-4">
      {error && <p className="text-red-500 text-center font-medium">{error}</p>}
    </div>
  </div>
  );
}


//types of emit events
// 1. "connection" - When a new user connects (by default)
// 2. "register-username" (username) - Register a username for the socket
// 3. "create-room" - Create a new rooms
// 4. "join-room" (roomId) - Join an existing room
// 5. "disconnect" - When a user disconnects (by default)
// 6. "leave-room" (roomId) - Leave a room
// 7. "signal" ({ to, signal }) - Relay signaling data for peer connection
// 8. "user-list" (roomId) - Get the list of users in a room
// 9. "camera-mic-status" ({roomId, camera, mic}) - Update camera and mic status for users in a room

//types of listen events
// 1. "room-id" (roomId)- Create a new room
// 2. "signal" ({ to, signal }) - Relay signaling data for peer connection
// 3. "user-joined" ({ id, username }) - Notify users in the room when a new user joins
// 4. "room-joined" ({ roomId, users[{id:,username:}] }) - Notify the user who joined about the room and its users
// 5. "user-left" (socketId) - Notify users in the room when a user leaves
// 6. "error" (message) - Send error messages to the user
// 7. "user-list" (userList) - Send the list of users in a room to the requesting user
// 8. "camera-mic-status" ({ id, camera, mic }) - Broadcast camera and mic status to all users in the room