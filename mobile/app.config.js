export default {
  expo: {
    name: "Lost & Hound",
    slug: "lost-and-hound",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/AppLogo.jpeg",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    scheme: "lostandhound",
    splash: {
      image: "./assets/AppLogo.jpeg",
      resizeMode: "contain",
      backgroundColor: "#A84D48",
    },
    ios: {
      bundleIdentifier: "com.lostandhound.app",
      supportsTablet: false,
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "",
      },
    },
    android: {
      package: "com.lostandhound.app",
      adaptiveIcon: {
        foregroundImage: "./assets/AppLogo.jpeg",
        backgroundColor: "#A84D48",
      },
      edgeToEdgeEnabled: true,
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        },
      },
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-notifications",
        {
          icon: "./assets/AppLogo.jpeg",
          color: "#A84D48",
        },
      ],
    ],
  },
};
