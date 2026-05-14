import { useState, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLanguage } from '../hooks/useLanguage';
import { useTheme } from '../context/ThemeContext';

interface AlertState {
  title: string;
  message?: string;
}

export function useAppAlert() {
  const [state, setState] = useState<AlertState | null>(null);
  const { isRTL, t } = useLanguage();
  const { colors } = useTheme();

  const showAlert = useCallback((title: string, message?: string) => {
    setState({ title, message });
  }, []);

  const dismiss = useCallback(() => setState(null), []);

  const AlertComponent = state ? (
    <Modal
      transparent
      animationType="fade"
      visible
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.box, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}>
            {state.title}
          </Text>
          {state.message ? (
            <Text style={[styles.message, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
              {state.message}
            </Text>
          ) : null}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.btn} onPress={dismiss} activeOpacity={0.6}>
            <Text style={[styles.btnText, { color: colors.accent }]}>
              {t('common.ok')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  ) : null;

  return { showAlert, AlertComponent };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  box: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
  },
  message: {
    fontSize: 13,
    paddingHorizontal: 16,
    paddingBottom: 16,
    lineHeight: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  btn: {
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 17,
    fontWeight: '500',
  },
});
