import 'dotenv/config';

export default {
  "expo": {
    "name": "CarnetBattageCrossPlatform",
    "slug": "CarnetBattageCrossPlatform",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.VibeCodingMind.PilingWork",
      "config": {
        "googleMapsApiKey": process.env.GOOGLE_MAPS_API_KEY_IOS
      }
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "package": "com.VibeCodingMind.PilingWork",
      "config": {
        "googleMaps": {
          "apiKey": process.env.GOOGLE_MAPS_API_KEY_ANDROID
        }
      }
    },
    "web": {
      "favicon": "./assets/favicon.png",
      "config": {
        "googleMaps": {
          "apiKey": process.env.GOOGLE_MAPS_API_KEY_WEB
        }
      }
    },
    "plugins": [
      "expo-sharing",
      "expo-mail-composer"
    ]
  }
};
