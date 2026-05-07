import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/context/ThemeContext';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ProviderDeepLink() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) { setNotFound(true); return; }

    (async () => {
      // If the slug is already a UUID, go directly to provider-profile
      if (UUID_RE.test(username)) {
        router.replace({ pathname: '/provider-profile', params: { provider_id: username } });
        return;
      }

      // Otherwise resolve username → provider id
      const { data } = await supabase
        .from('providers')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (data?.id) {
        router.replace({ pathname: '/provider-profile', params: { provider_id: data.id } });
      } else {
        setNotFound(true);
      }
    })();
  }, [username]);

  if (notFound) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.textSecondary, fontSize: 16 }}>لم يتم العثور على هذا المزود</Text>
      </View>
    );
  }

  return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
