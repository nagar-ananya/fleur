/**
 * The chime that sounds when a Reset timer finishes, with vibration. `ring`
 * repeats until `stop` (an alarm) or plays once (`ring(false)`, a gentle end
 * to a breathing exercise). Leaving the screen always stops it.
 */

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
      // Already released on unmount — nothing left to stop.
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
