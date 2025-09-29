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
      // ✅ REQUIRED for expo-image-picker & camera
      infoPlist: {
        NSPhotoLibraryUsageDescription:
          "We need access to your photo library so you can attach images and videos.",
        NSCameraUsageDescription:
          "We need access to your camera so you can take photos and record videos.",
        NSMicrophoneUsageDescription:
          "We need access to your microphone so you can record audio.",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      // REQUIRED for expo-image-picker, document-picker, audio
      permissions: [
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "CAMERA",
        "RECORD_AUDIO",
        // On Android 13+ granular permissions:
        "READ_MEDIA_IMAGES",
        "READ_MEDIA_VIDEO",
        "READ_MEDIA_AUDIO",
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
  },
};