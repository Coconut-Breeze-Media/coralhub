import { AuthProvider } from './lib/auth';
import { Slot } from 'expo-router';
import { useEffect } from "react";
import { detectBpRoutes } from "./lib/api/buddypress/routes";


export default function App() {
  useEffect(() => {
    detectBpRoutes().catch(() => {});
  }, []);

  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  );
}