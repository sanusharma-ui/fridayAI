import { useWindowDimensions } from "react-native";

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const isCompact = width < 360;
  const isTablet = width >= 640;
  const isLandscape = width > height;

  const horizontalPad = isTablet ? 28 : isCompact ? 12 : 16;
  const contentMaxWidth = isTablet ? 740 : undefined;
  const bentoColumns = width >= 345 ? 2 : 1;
  const drawerWidth = Math.min(Math.round(width * 0.82), 320);

  return {
    width,
    height,
    isCompact,
    isTablet,
    isLandscape,
    horizontalPad,
    contentMaxWidth,
    bentoColumns,
    drawerWidth,
  };
}
