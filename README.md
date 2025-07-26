# 🎥 Peer-to-Peer Video Chat App — Frontend

This is the **frontend** of a privacy-focused, peer-to-peer video chat application. Built using **Next.js**, **TypeScript**, and **Tailwind CSS**, this project offers real-time video conferencing with up to 4 users per room — all without collecting personal information like emails. Video transmission is strictly peer-to-peer using **Simple-Peer** and **WebRTC**, with the backend only facilitating signaling.

🌐 **Live Demo**: [https://video-chat2-frontend.onrender.com](https://video-chat2-frontend.onrender.com)

🔗 **Backend Repo**: [video-chat-backend](https://github.com/RishabhShrival/video-chat2-backend) 

---

## 🔐 Key Features

- 🔒 No email required — username and password-based authentication via Firebase
- 🢑 Join or create rooms using a unique Room ID
- 👥 Maximum 4 participants per room
- 📹 End-to-end video and audio via WebRTC (peer-to-peer)
- 🎛️ Mic and Camera toggles with status indicators
- 🌗 Dark mode (based on system preference)
- 📱 Responsive layout (mobile + desktop)
- ⚡ Minimal backend usage — only for signaling

---

## 🧠 Technologies Used

- **Next.js** with **TypeScript**
- **Tailwind CSS** for styling
- **Simple-Peer** for WebRTC signaling abstraction
- **Firebase** for lightweight auth
- **Socket.IO** for real-time communication

---

## 📦 Setup Instructions

### 1. Clone the repo

```bash
git clone https://github.com/RishabhShrival/video-chat2-frontend
cd video-chat2-frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000 # or your deployed backend URL

NEXT_PUBLIC_FIREBASE_API_KEY=your-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_MEASURMENT_ID=your-measurement-id
NEXT_PUBLIC_PORT=5000
```

### 4. Start the development server

```bash
npx run dev
or
npm run dev
```

---

## 🔄 Events and APIs

This frontend uses the following **Socket.IO events** to communicate with the backend:

### Emit Events

| Event | Description |
|-------|-------------|
| `register-username` | Send username to backend |
| `create-room` | Create a new room |
| `join-room` | Join an existing room |
| `leave-room` | Leave the current room |
| `signal` | Send WebRTC signaling data |
| `camera-mic-status` | Update mic/camera toggle |
| `user-list` | Request active user list |

### Listen Events

| Event | Description |
|-------|-------------|
| `room-id` | Received after room is created |
| `room-joined` | Received after joining a room |
| `user-joined` | Another user joined |
| `user-left` | User disconnected |
| `signal` | Receive signaling data |
| `error` | Any errors |
| `camera-mic-status` | Receive camera/mic status |
| `user-list` | List of users in room |

---

## 📂 Folder Structure

```
/app/videochat
  ├── page.tsx          # Main video call logic
/components
  ├── VideoPlayer.tsx   # For remote peers
  ├── LocalVideoPlayer.tsx # For local user
/public/images/icons    # Camera, mic, leave icons
```

---

## ✅ TODO / Improvements

- Better error handling during signaling
- Optional text chat or screen sharing
- Adaptive bitrate & network quality indicators

---

## 🔪 Testing

Run locally and open in two different browser tabs to test room creation, join, and peer streaming.

---

## 🔗 Related Projects

- **Backend**: [video-chat-backend](https://github.com/RishabhShrival/video-chat2-backend)

---

## 🢁 Author

Built by [Rishabh Shrival](https://github.com/RishabhShrival)

