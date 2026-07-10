// app.config.js
export default {
    expo: {
      name: "CoRR Hub",
      slug: "coralhub",
      scheme: "corrhub",
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
        bundleIdentifier: "com.corrhub.app",
        buildNumber: "1",
        infoPlist: {
          NSPhotoLibraryUsageDescription: "CoRR Hub needs access to your photo library so you can upload images to posts and update your profile photos.",
        },
      },
      android: {
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon.png",
          backgroundColor: "#ffffff",
        },
        edgeToEdgeEnabled: true,
        package: "com.corrhub.app",
        versionCode: 1,
        permissions: [
          "android.permission.POST_NOTIFICATIONS",
          "android.permission.READ_MEDIA_IMAGES"
        ],
        blockedPermissions: [
          "android.permission.RECORD_AUDIO"
        ],
      },
      web: {
        favicon: "./assets/favicon.png",
      },
      plugins: [
        "expo-router",
        [
          "expo-image-picker",
          {
            photosPermission: "CoRR Hub needs access to your photo library so you can upload images to posts and update your profile photos."
          }
        ],
        "expo-notifications"
      ],
      extra: {
        eas: {
          projectId: "21162a1d-7628-4e29-b0b1-fd4931db0a29",
        },
      },
    },
  };
