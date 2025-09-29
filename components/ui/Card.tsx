import { View, type ViewProps, Platform } from 'react-native';

export default function Card({ style, ...rest }: ViewProps) {
  return (
    <View
      style={[
        {
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: 12,
          // subtle shadow
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
          borderWidth: Platform.OS === 'ios' ? 0 : 1,
          borderColor: '#eef2f7',
        },
        style,
      ]}
      {...rest}
    />
  );
}