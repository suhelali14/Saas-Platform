// Android emulator: use http://10.0.2.2:4000 instead of localhost.
// Physical device (Expo Go): use your machine's LAN IP, e.g. http://192.168.1.20:4000.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
