import React from "react";
import Svg, { Path } from "react-native-svg";
import { colors } from "../theme/colors";

interface FridayMarkProps {
  size?: number;
  color?: string;
}

export function FridayMark({ size = 24, color = colors.accent }: FridayMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M7 27V5H12V27H7ZM15 5H27L23 10H15V5ZM15 14H24L20 19H15V14Z"
        fill={color}
      />
    </Svg>
  );
}
