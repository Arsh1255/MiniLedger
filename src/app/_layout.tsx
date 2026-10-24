import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#6553A2',
    onPrimary: '#FFFFFF',
    primaryContainer: '#EADDFF',
    onPrimaryContainer: '#26134D',
    secondary: '#59627A',
    tertiary: '#8A4A63',
    background: '#F7F4FC',
    surface: '#FFFBFF',
    onBackground: '#45424C',
    onSurface: '#45424C',
    onSurfaceVariant: '#6B6872',
  },
};

export default function RootLayout() {
  return <PaperProvider theme={theme}><SafeAreaProvider><StatusBar style="dark"/><Stack screenOptions={{ headerShown: false }} /></SafeAreaProvider></PaperProvider>;
}
