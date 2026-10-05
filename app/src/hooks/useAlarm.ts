import { useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect } from 'react';
import { Vibration } from 'react-native';

const CHIME = require('../../assets/sounds/alarm.wav');

export function useAlarm(): { ring: (repeat?: boolean) => void; stop: () => void } {
  const player = useAudioPlayer(CHIME);

  const stop = useCallback(() => {
    try {
      player.pause();
    } catch {
    }
    Vibration.cancel();
  }, [player]);

  const ring = useCallback(
    (repeat = true) => {
      player.loop = repeat;
      void player.seekTo(0).then(() => player.play());
      Vibration.vibrate(repeat ? [0, 600, 400] : [0, 400], repeat);
    },
    [player],
  );

  useEffect(() => () => Vibration.cancel(), []);

  return { ring, stop };
}
