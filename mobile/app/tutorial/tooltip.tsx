/**
 * TutorialTooltip — a safe, Modal-based tooltip card.
 * Shown once per TooltipKey (tracked via useTutorial).
 * Uses a transparent Modal overlay so it never conflicts
 * with existing Modals or z-index stacking in the feed screens.
 */
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme }    from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/hooks/useLanguage';
import type { AppColors } from '../../src/constants/colors';

interface Props {
  visible:   boolean;
  icon:      string;
  titleKey:  string;
  subKey:    string;
  onDismiss: () => void;
}

export function TutorialTooltip({ visible, icon, titleKey, subKey, onDismiss }: Props) {
  const { colors } = useTheme();
  const { t }      = useLanguage();
  const st         = styles(colors);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      {/* Dimmed backdrop — tap anywhere to dismiss */}
      <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={onDismiss}>
        {/* Card — stop propagation so tap on card doesn't dismiss */}
        <TouchableOpacity style={st.card} activeOpacity={1} onPress={() => {}}>

          <View style={st.iconCircle}>
            <Text style={st.icon}>{icon}</Text>
          </View>

          <Text style={st.title}>{t(titleKey)}</Text>
          <Text style={st.sub}>{t(subKey)}</Text>

          <TouchableOpacity style={st.btn} onPress={onDismiss}>
            <Text style={st.btnText}>{t('tutorial.tooltipGotIt')}</Text>
          </TouchableOpacity>

          {/* Arrow indicator pointing down toward tab bar */}
          <View style={st.arrowDown} />

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function styles(colors: AppColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    card: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 28,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 12,
    },
    iconCircle: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: colors.bg,
      borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 20,
    },
    icon:  { fontSize: 34 },
    title: {
      fontSize: 18, fontWeight: '800', color: colors.textPrimary,
      textAlign: 'center', marginBottom: 10,
    },
    sub: {
      fontSize: 14, color: colors.textSecondary,
      textAlign: 'center', lineHeight: 22, marginBottom: 24,
    },
    btn: {
      backgroundColor: colors.accent, borderRadius: 14,
      paddingVertical: 13, paddingHorizontal: 40,
    },
    btnText: { fontSize: 15, fontWeight: '700', color: colors.bg },

    arrowDown: {
      position: 'absolute', bottom: -12, left: '50%',
      marginLeft: -10,
      width: 0, height: 0,
      borderLeftWidth: 10, borderLeftColor: 'transparent',
      borderRightWidth: 10, borderRightColor: 'transparent',
      borderTopWidth: 12, borderTopColor: colors.surface,
    },
  });
}
