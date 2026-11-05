import { VideoView, useVideoPlayer } from "expo-video";
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";

type Props = {
  uri: string;
  playing: boolean;
  onDone: () => void;
  onProgress: (value: number) => void;
};
export function StoryVideo({ uri, playing, onDone, onProgress }: Props) {
  const player = useVideoPlayer({ uri, useCaching: true }, (instance) => {
    instance.loop = false;
    instance.timeUpdateEventInterval = 0.15;
    instance.staysActiveInBackground = false;
  });
  useEffect(() => {
    if (playing) player.play();
    else player.pause();
    return () => player.pause();
  }, [player, playing]);
  useEffect(() => {
    const progress = player.addListener("timeUpdate", ({ currentTime }) => {
      if (player.duration > 0)
        onProgress(Math.max(0, Math.min(1, currentTime / player.duration)));
    });
    const ended = player.addListener("playToEnd", onDone);
    return () => {
      progress.remove();
      ended.remove();
    };
  }, [player, onDone, onProgress]);
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
    />
  );
}
