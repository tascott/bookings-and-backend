export default ({ config }) => {
  return {
    ...config, // Start with the existing configuration (if any from a base app.json it might extend)
    expo: {
      name: "mobile",
      slug: "mobile",
      version: "1.0.0",
      orientation: "portrait",
      icon: "./assets/icon.png",
      userInterfaceStyle: "light",
      newArchEnabled: true, // Assuming this was intentional from your app.json
      splash: {
        image: "./assets/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff"
      },
      ios: {
        supportsTablet: true
      },
      android: {
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon.png",
          backgroundColor: "#ffffff"
        },
        edgeToEdgeEnabled: true // Assuming this was intentional
      },
      web: {
        favicon: "./assets/favicon.png"
      },
      extra: {
        // Dynamically set the apiBaseUrl from the environment variable
        apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || "", // Fallback to empty string if not set
        // If you use EAS Build, you might have a projectId here too
        // eas: {
        //   projectId: process.env.EAS_PROJECT_ID || "YOUR_EAS_PROJECT_ID_FALLBACK"
        // }
      },
      plugins: [
        "expo-secure-store"
      ]
      // Spread any other properties from the original config.expo if needed
      // For example, if the original config.expo had other top-level keys not listed above:
      // ...config.expo,
    }
  };
};