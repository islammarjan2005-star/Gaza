import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

interface TabBarIconProps {
  name: 'search' | 'heart' | 'chart' | 'settings';
  color: string;
  size: number;
}

export function TabBarIcon({ name, color, size }: TabBarIconProps) {
  const iconSize = size || 24;

  switch (name) {
    case 'search':
      return (
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
          <Circle
            cx="11"
            cy="11"
            r="7"
            stroke={color}
            strokeWidth="2"
            fill="none"
          />
          <Path
            d="M16 16L20 20"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'heart':
      return (
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill={color}
          />
        </Svg>
      );

    case 'chart':
      return (
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
          <Rect
            x="4"
            y="14"
            width="4"
            height="8"
            rx="1"
            fill={color}
          />
          <Rect
            x="10"
            y="10"
            width="4"
            height="12"
            rx="1"
            fill={color}
          />
          <Rect
            x="16"
            y="4"
            width="4"
            height="18"
            rx="1"
            fill={color}
          />
        </Svg>
      );

    case 'settings':
      return (
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
          <G stroke={color} strokeWidth="2" fill="none">
            <Circle cx="12" cy="12" r="3" />
            <Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </G>
        </Svg>
      );

    default:
      return null;
  }
}

const styles = StyleSheet.create({});
