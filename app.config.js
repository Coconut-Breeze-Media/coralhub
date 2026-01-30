// app.config.js
export default {
    expo: {
      name: "The Coral Reef Research Hub",
      slug: "coralhub",
      scheme: "coralhub",
      version: "1.0.0",
      orientation: "portrait",
      icon: "./assets/icon.png",
      userInterfaceStyle: "light",
      newArchEnabled: true,
      splash: {
        image: "./assets/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
      ios: {
        supportsTablet: true,
        bundleIdentifier: "com.coralhub.app",
      },
      android: {
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon.png",
          backgroundColor: "#ffffff",
        },
        edgeToEdgeEnabled: true,
        package: "com.coralhub.app",
      },
      web: {
        favicon: "./assets/favicon.png",
      },
      plugins: [
        "expo-notifications"
      ],
      extra: {
        eas: {
          projectId: "21162a1d-7628-4e29-b0b1-fd4931db0a29",
        },
      },
    },
  };