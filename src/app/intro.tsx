import { useRouter } from 'expo-router';
import { Platform, StatusBar, View } from 'react-native';

import { IntroFlow } from '@/components/onboarding/IntroFlow';
import { useSettingsStore } from '@/stores/settings.store';

export default function IntroScreen() {
  const router = useRouter();
  const setHasSeenIntro = useSettingsStore((s) => s.setHasSeenIntro);

  const handleFinish = () => {
    setHasSeenIntro(true);
    router.replace('/(auth)/login');
  };

  return (
    <View style={{ flex: 1 }}>
      {Platform.OS === 'android' && (
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle="dark-content"
        />
      )}
      <IntroFlow onFinish={handleFinish} />
    </View>
  );
}
