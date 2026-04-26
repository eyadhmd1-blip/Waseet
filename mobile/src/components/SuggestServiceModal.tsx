import { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../hooks/useLanguage';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Phase = 'form' | 'success';

export function SuggestServiceModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { t, ta } = useLanguage();

  const [phase, setPhase]       = useState<Phase>('form');
  const [value, setValue]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleClose = () => {
    setValue('');
    setError('');
    setPhase('form');
    onClose();
  };

  const handleSubmit = async () => {
    const name = value.trim();
    if (!name) { setError(t('suggestions.nameRequired')); return; }
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setError(t('common.error')); return; }

      const { error: dbErr } = await supabase
        .from('service_suggestions')
        .insert({ user_id: session.user.id, service_name: name });

      if (dbErr) { setError(t('suggestions.errorMsg')); return; }

      setPhase('success');
    } catch {
      setError(t('suggestions.errorMsg'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          {phase === 'form' ? (
            <>
              <Text style={[styles.title, { color: colors.textPrimary, textAlign: ta }]}>
                {t('suggestions.modalTitle')}
              </Text>
              <Text style={[styles.sub, { color: colors.textMuted, textAlign: ta }]}>
                {t('suggestions.modalSub')}
              </Text>

              <TextInput
                style={[styles.input, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.textPrimary, textAlign: ta }]}
                placeholder={t('suggestions.placeholder')}
                placeholderTextColor={colors.textMuted}
                value={value}
                onChangeText={v => { setValue(v); setError(''); }}
                maxLength={100}
                autoFocus
              />

              {error ? (
                <Text style={[styles.error, { textAlign: ta }]}>{error}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.accent }, (!value.trim() || loading) && { opacity: 0.5 }]}
                onPress={handleSubmit}
                disabled={!value.trim() || loading}
              >
                {loading
                  ? <ActivityIndicator color={colors.bg} />
                  : <Text style={[styles.btnText, { color: colors.bg }]}>{t('suggestions.submit')}</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                <Text style={[styles.cancelText, { color: colors.textMuted }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.successEmoji}>✅</Text>
              <Text style={[styles.title, { color: colors.textPrimary, textAlign: 'center' }]}>
                {t('suggestions.successTitle')}
              </Text>
              <Text style={[styles.sub, { color: colors.textMuted, textAlign: 'center' }]}>
                {t('suggestions.successMsg')}
              </Text>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.accent }]}
                onPress={handleClose}
              >
                <Text style={[styles.btnText, { color: colors.bg }]}>{t('common.close')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:     { flex: 1, justifyContent: 'flex-end' },
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:       { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 24, paddingBottom: 36 },
  title:       { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  sub:         { fontSize: 13, marginBottom: 20, lineHeight: 20 },
  input:       { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 8 },
  error:       { fontSize: 12, color: '#EF4444', marginBottom: 8 },
  btn:         { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnText:     { fontSize: 16, fontWeight: '700' },
  cancelBtn:   { paddingVertical: 12, alignItems: 'center' },
  cancelText:  { fontSize: 14 },
  successEmoji:{ fontSize: 48, textAlign: 'center', marginBottom: 12 },
});
