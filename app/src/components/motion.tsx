import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export function Reveal({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      delay: delay * 0.6,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress]);

  return <Animated.View style={[style, { opacity: progress }]}>{children}</Animated.View>;
}

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
      bounciness: 3,
    }).start();
  };

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
