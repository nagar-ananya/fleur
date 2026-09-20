/**
 * Motion primitives.
 *
 * All built on React Native's own `Animated`, deliberately: adding Reanimated
 * would mean a native rebuild and another dependency (§16) for effects this
 * small. Everything here runs on the native driver except SVG stroke
 * animation, which cannot.
 *
 * Motion is used to establish hierarchy — content arrives in reading order —
 * never to decorate. Durations stay under 500ms so the app never feels slow.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/** Content settles upward into place, staggered by `delay`. */
export function Reveal({
  children,
  delay = 0,
  distance = 14,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Press feedback that actually feels physical. Cards and buttons dip slightly
 * under the finger and spring back.
 */
export function PressableScale({
  children,
  onPress,
  style,
  scaleTo = 0.97,
  disabled,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  accessibilityHint,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: PressableProps['accessibilityRole'];
  accessibilityState?: PressableProps['accessibilityState'];
  accessibilityHint?: string;
}): React.ReactElement {
  const scale = useRef(new Animated.Value(1)).current;

  const to = (value: number): void => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  // The style lands on the Pressable itself rather than on an inner wrapper.
  // With a nested view, layout styles such as `flex: 1` applied to the child
  // do nothing — the Pressable still sizes to its content — so a button in a
  // row shrank to hug its label instead of filling the space.
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      accessibilityHint={accessibilityHint}
      style={[style, { transform: [{ scale }], opacity: disabled ? 0.45 : 1 }]}
    >
      {children}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Counts a number up on mount. The risk percentage arriving at its value reads
 * as a measurement being taken rather than a verdict being pronounced.
 */
export function useCountUp(target: number, duration = 900, decimals = 0): string {
  const [display, setDisplay] = useState(0);
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    value.setValue(0);
    const id = value.addListener(({ value: v }) => setDisplay(v * target));
    const animation = Animated.timing(value, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      animation.stop();
      value.removeListener(id);
    };
  }, [target, duration, value]);

  return display.toFixed(decimals);
}

/** A slow, endless drift used behind the aurora washes. */
export function useDrift(duration = 9000): Animated.Value {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, duration]);

  return drift;
}
