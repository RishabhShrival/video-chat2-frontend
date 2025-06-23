'use client';

import { useEffect, useRef } from 'react';
import React from 'react';
import VideoPlayer from './VideoPlayer';

type Props = {
  remoteStreams: { peerId: string; stream: MediaStream }[] | null;
  remoteMediaStatus: {
    [id: string]: {
      camera: boolean;
      mic: boolean;
    };
  };
  userList: { id: string; username: string }[];
  totalUsers?: number;
  localStream?: MediaStream | null;
  cameraOn?: boolean;
};

export default function RemoteStreamLayout({
  remoteStreams,
  remoteMediaStatus,
  userList,
  totalUsers = 0,
  localStream = null,
  cameraOn = true,
}: Props) {
  const videoRefs = useRef<{ [peerId: string]: HTMLVideoElement | null }>({});
  const localStreamRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (remoteStreams) {
      remoteStreams.forEach(({ peerId, stream }) => {
        if (videoRefs.current[peerId]) {
          videoRefs.current[peerId]!.srcObject = stream;
        }
      });
    }
  }, [remoteStreams]);

  useEffect(() => {
      if (localStreamRef.current) {
        localStreamRef.current.srcObject = localStream;
      }
    }, [localStream]);

  // Return null if totalUsers is 0 or 1
  if (totalUsers === 0) {
    return null;
  }

  // Layout styles based on totalUsers
  const layoutStyles =
    totalUsers === 1
      ?  'fixed flex items-center justify-center w-full'// Centered single video
      : totalUsers === 2
      ? 'fixed flex flex-col lg:flex-row w-full items-center justify-center' // Side-by-side videos
      : 'fixed grid lg:grid-rows-2 grid-cols-2 gap-4 items-center justify-items-center'; // 2x2 grid for 4 users

  return (
    <div className={`relative ${layoutStyles} p-4`}>
      {remoteStreams &&
        remoteStreams.map(({ peerId, stream }, index) => {
          return (
            <div
              key={peerId}
              className={`relative ${
                totalUsers === 1
                  ? 'w-full h-auto lg:w-auto lg:max-w-xl': // Fullscreen for 2 users
                  totalUsers === 2
                  ? 'w-full h-auto flex-1/2 lg:w-auto lg:max-w-xl' // Half
                  : 'lg:max-w-xxs w-full h-auto items-center justify-center' // Square aspect for 3 or 4 users
              } bg-gray-700 dark:bg-gray-600 rounded-lg shadow-md overflow-hidden`}
            >
              <VideoPlayer
                stream={stream}
                cameraOn={remoteMediaStatus[peerId]?.camera ?? true}
                micOn={remoteMediaStatus[peerId]?.mic ?? true}
                username={userList.find((user) => user.id === peerId)?.username || 'Unknown'}
              />
            </div>
          );
        })}
        {totalUsers > 2 && <div key={"You"}
          className={`relative lg:max-w-xxs w-full h-auto lg:w-auto items-center justify-center bg-gray-700 dark:bg-gray-600 rounded-lg shadow-md overflow-hidden`}>
            <VideoPlayer
                stream={localStream}
                cameraOn={cameraOn}
                micOn={true} // Assuming mic is always on for local user
                username="You"
                muted={true}
            />
        </div>
        }
        </div>
  );
}