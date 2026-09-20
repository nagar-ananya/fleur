/**
 * Icon set, hand-drawn on react-native-svg.
 *
 * §11.5 rules out a component library, and an icon font would be one. These
 * are deliberately plain geometric strokes — nothing that reads as an alarm,
 * a warning triangle, or an exclamation mark anywhere near risk.
 */

import React from 'react';
import Svg, { Circle, Path, Rect, type NumberProp } from 'react-native-svg';

export interface IconProps {
  size?: number;
  color: string;
  strokeWidth?: NumberProp;
}

function Icon({
  size = 22,
  children,
}: {
  size?: number;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {children}
    </Svg>
  );
}

const stroke = (color: string, strokeWidth: NumberProp = 1.8) => ({
  stroke: color,
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none' as const,
});

export function TodayIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Circle cx={12} cy={12} r={8.2} {...stroke(color, strokeWidth)} />
      <Path d="M12 7.6V12l3 1.9" {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function InsightsIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Path d="M4.5 18.5v-4.2" {...stroke(color, strokeWidth)} />
      <Path d="M9.5 18.5V9" {...stroke(color, strokeWidth)} />
      <Path d="M14.5 18.5v-6.6" {...stroke(color, strokeWidth)} />
      <Path d="M19.5 18.5V5.5" {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function HistoryIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Rect x={3.8} y={5} width={16.4} height={15.2} rx={3} {...stroke(color, strokeWidth)} />
      <Path d="M3.8 9.8h16.4M8.6 3.2v3.4M15.4 3.2v3.4" {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function SettingsIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Path d="M4 7.5h9M17.5 7.5H20M4 16.5h3.5M12 16.5h8" {...stroke(color, strokeWidth)} />
      <Circle cx={15} cy={7.5} r={2.4} {...stroke(color, strokeWidth)} />
      <Circle cx={9.5} cy={16.5} r={2.4} {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function ChevronRight({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Path d="M9.5 5.5L16 12l-6.5 6.5" {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function CheckIcon({ size, color, strokeWidth = 2.4 }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Path d="M5 12.5l4.6 4.5L19 7" {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function TrendUpIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Path d="M4 15.5l5-5 3.5 3.5L20 7" {...stroke(color, strokeWidth)} />
      <Path d="M15 7h5v5" {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function TrendDownIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Path d="M4 8.5l5 5 3.5-3.5L20 17" {...stroke(color, strokeWidth)} />
      <Path d="M15 17h5v-5" {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function ThermometerIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Path d="M14 13.6V5.4a2 2 0 10-4 0v8.2a4 4 0 104 0z" {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function DropletIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Path d="M12 3.5s6 6.1 6 9.8a6 6 0 11-12 0c0-3.7 6-9.8 6-9.8z" {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function SunIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Circle cx={12} cy={12} r={4} {...stroke(color, strokeWidth)} />
      <Path
        d="M12 2.8v2.4M12 18.8v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7"
        {...stroke(color, strokeWidth)}
      />
    </Icon>
  );
}

export function HazeIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Path d="M3.5 8.5h11M17.5 8.5h3M3.5 13h4M10 13h10.5M3.5 17.5h13M19.5 17.5h1" {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function LeafIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Path d="M20 4c0 9-5.5 13.5-11 13.5A5 5 0 014 12.5C4 7 9 4 20 4z" {...stroke(color, strokeWidth)} />
      <Path d="M14 9.5L5.5 19" {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function SparkIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Path
        d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"
        {...stroke(color, strokeWidth)}
      />
      <Path d="M18.5 16.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function ShieldIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Path d="M12 3.2l7 2.8v5.4c0 4.2-2.9 7.6-7 9.4-4.1-1.8-7-5.2-7-9.4V6z" {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function ExportIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Path d="M12 15.5V4M8.5 7.5L12 4l3.5 3.5" {...stroke(color, strokeWidth)} />
      <Path d="M4.5 14.5v3.6a2 2 0 002 2h11a2 2 0 002-2v-3.6" {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function TrashIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Path d="M4.5 6.5h15M9.5 6.5V4.6a1.4 1.4 0 011.4-1.4h2.2a1.4 1.4 0 011.4 1.4v1.9" {...stroke(color, strokeWidth)} />
      <Path d="M6.6 6.5l.8 12a2 2 0 002 1.9h5.2a2 2 0 002-1.9l.8-12" {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function PersonIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Circle cx={12} cy={8} r={3.8} {...stroke(color, strokeWidth)} />
      <Path d="M4.8 20.2a7.2 7.2 0 0114.4 0" {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function PinIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Path d="M12 21s6.5-6.1 6.5-10.5a6.5 6.5 0 10-13 0C5.5 14.9 12 21 12 21z" {...stroke(color, strokeWidth)} />
      <Circle cx={12} cy={10.3} r={2.4} {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function PulseIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Path d="M3 12.5h4l2.2-5.6 3.4 10.7L15.4 12H21" {...stroke(color, strokeWidth)} />
    </Icon>
  );
}

export function InfoIcon({ size, color, strokeWidth }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Circle cx={12} cy={12} r={8.4} {...stroke(color, strokeWidth)} />
      <Path d="M12 11v5.2" {...stroke(color, strokeWidth)} />
      <Circle cx={12} cy={8.1} r={0.9} fill={color} />
    </Icon>
  );
}

export function PlusIcon({ size, color, strokeWidth = 2.2 }: IconProps): React.ReactElement {
  return (
    <Icon size={size}>
      <Path d="M12 5.5v13M5.5 12h13" {...stroke(color, strokeWidth)} />
    </Icon>
  );
}
