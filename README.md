# CoralHub

This is an Expo / React Native project for The Coral Reef Research Hub.
  
## Prerequisites

- Node.js (LTS recommended)
- npm (comes with Node.js)

## Setup

1.  Navigate to the project directory:
    ```bash
    cd coralhub
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

## Running the App

To start the development server:
```bash
npm start
```

This will run `expo start`. You can then:
- Press `a` for Android (requires emulator or connected device).
- Press `i` for iOS (requires simulator or Mac).
- Press `w` for Web.
- Scan the QR code with the Expo Go app on your physical device.

## Environment Variables

The project uses a `.env` file for configuration. Ensure this file exists in the `coralhub` root.
Current required variables:
- `EXPO_PUBLIC_WP_URL`
- `EXPO_PUBLIC_WP_API`
- `EXPO_PUBLIC_JOIN_URL`
