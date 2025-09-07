import { AuthProvider } from './lib/auth';
import { Slot } from 'expo-router';

export default function App() {
  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  );
}