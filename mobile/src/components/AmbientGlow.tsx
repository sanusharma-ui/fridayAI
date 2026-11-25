import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

export function AmbientGlow() {
  return (
    <View style={styles.container} pointerEvents="none">
      <Svg width="100%" height="320" viewBox="0 0 400 320" preserveAspectRatio="xMidYMin slice">
        <Defs>
          <RadialGradient id="warmGlow" cx="82%" cy="12%" rx="58%" ry="55%">
            <Stop offset="0%" stopColor="#F27D52" stopOpacity="0.16" />
            <Stop offset="55%" stopColor="#F27D52" stopOpacity="0.04" />
            <Stop offset="100%" stopColor="#0B0E13" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="coolGlow" cx="15%" cy="22%" rx="55%" ry="50%">
            <Stop offset="0%" stopColor="#3B82F6" stopOpacity="0.13" />
            <Stop offset="60%" stopColor="#2DD4A0" stopOpacity="0.03" />
            <Stop offset="100%" stopColor="#0B0E13" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="330" cy="40" r="220" fill="url(#warmGlow)" />
        <Circle cx="65" cy="70" r="200" fill="url(#coolGlow)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
});
