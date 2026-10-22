import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { PRIVACY_URL, TERMS_URL } from '../../../src/data/legal';

export function LegalLinks({ dark = false }: { dark?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
      {[[PRIVACY_URL, 'Privacy Policy'], [TERMS_URL, 'Terms of Use']].map(([url, label]) => (
        <Pressable key={url} accessibilityRole="link" onPress={() => void Linking.openURL(url).catch(() => Alert.alert('Unable to open link', `Please open ${url} in your browser.`))}
          style={{ minHeight: 48, justifyContent: 'center' }}>
          <Text style={{ color: dark ? '#6ee7b7' : '#047857', textDecorationLine: 'underline', fontSize: 14 }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
