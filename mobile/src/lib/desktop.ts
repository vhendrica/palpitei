import { Platform, useWindowDimensions } from "react-native";

/** Desktop = web com viewport larga. Mobile/tablet nativo e web estreita seguem o layout de hoje. */
export function useDesktop() {
  const { width } = useWindowDimensions();
  return Platform.OS === "web" && width >= 1024;
}
