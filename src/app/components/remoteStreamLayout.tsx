'use client'

import { useEffect, useRef } from 'react';
import React from 'react';
import VideoPlayer from './VideoPlayer';

type Props = {
    remoteStreams: {peerId: string ;stream: MediaStream }[] | null;
    remoteMediaStatus: {
        [id: string]: {
            camera: boolean;
            mic: boolean;
        };
    };
}

export default function RemoteStreamLayout({ remoteStreams, remoteMediaStatus }: Props) {
    const videoRefs = useRef<{ [peerId: string]: HTMLVideoElement | null }>({});

    useEffect(() => {
        if (remoteStreams) {
            remoteStreams.forEach(({ peerId, stream }) => {
                if (videoRefs.current[peerId]) {
                    videoRefs.current[peerId]!.srcObject = stream;
                }
            });
        }
    }, [remoteStreams]);

    return (
        <div className="flex flex-wrap justify-center gap-4 p-4">
            {remoteStreams && remoteStreams.map(({ peerId, stream }) => (
                <div key={peerId} className="relative w-1/3 h-64">
                    <VideoPlayer
                        stream={stream}
                        cameraOn={remoteMediaStatus[peerId]?.camera ?? true}
                        micOn={remoteMediaStatus[peerId]?.mic ?? true}
                        username={peerId}
                    />
                </div>
            ))}
        </div>
    );
}