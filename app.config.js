import 'dotenv/config';

export default {
  "expo": {
    "name": "smart-piling",
    "slug": "smart-piling",
    "owner": "vibe-coding-mind",
    "version": "1.0.0",
    "extra": {
      "eas": {
        "projectId": "80dd4c4a-6b37-4e9e-9497-9403fdb745f2"
      }
    },
    "orientation": "portrait",
    "icon": "./assets/icon.jpg",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/icon.jpg",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.VibeCodingMind.SmartPiling",
      "googleServicesFile": "./GoogleService-Info.plist",
      "config": {
        "googleMapsApiKey": process.env.GOOGLE_MAPS_API_KEY_IOS
      }
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/icon.jpg",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "package": "com.VibeCodingMind.SmartPiling",
      "googleServicesFile": "./google-services.json",
      "config": {
        "googleMaps": {
          "apiKey": process.env.GOOGLE_MAPS_API_KEY_ANDROID
        }
      }
    },
    "web": {
      "favicon": "./assets/icon.jpg",
      "config": {
        "googleMaps": {
          "apiKey": process.env.GOOGLE_MAPS_API_KEY_WEB
        }
      }
    },
    "plugins": [
      "expo-sharing",
      "expo-mail-composer",
      "@react-native-community/datetimepicker",
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
      [
        "expo-build-properties",
        {
          "ios": {
            "useFrameworks": "static"
          }
        }
      ]
    ]
  }
};
