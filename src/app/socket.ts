import { io, Socket } from "socket.io-client";

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_BACKEND_URL; // Replace with your backend URL

export const socket: Socket = io(SOCKET_SERVER_URL, {
    autoConnect: true,
});
