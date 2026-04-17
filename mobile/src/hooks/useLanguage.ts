// ============================================================
// WASEET — useLanguage hook
// Provides: t(), lang, isRTL, ta (textAlign), changeLanguage()
//
// Usage in any screen:
//   const { t, isRTL, ta, changeLanguage } = useLanguage();
//   <Text style={[styles.title, { textAlign: ta }]}>{t('home.greeting')}</Text>
// ============================================================

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import type { TextStyle } from 'react-native';
import { changeLanguage as changeLangFn } from '../i18n';
import type { Lang } from '../i18n';

export function useLanguage() {
  const { t, i18n } = useTranslation();
  const lang  = i18n.language as Lang;
  const isRTL = lang === 'ar';

  // textAlign for the current direction — use as inline style override
  const ta: TextStyle['textAlign'] = isRTL ? 'right' : 'left';

  // rowDirection — use for flex containers that need direction awareness
  const rowDir: TextStyle['flexDirection'] = isRTL ? 'row-reverse' : 'row';

  const changeLanguage = useCallback(
    async (newLang: Lang) => {
      if (newLang === lang) return;
      await changeLangFn(newLang);
      // The Alert here is handled by the UI component calling this function.
      // After calling changeLanguage(), the navigator will be remounted via
      // the appKey state in _layout.tsx.
    },
    [lang],
  );

  const toggleLanguage = useCallback(async () => {
    const next = lang === 'ar' ? 'en' : 'ar';
    const msgKey = next === 'ar'
      ? 'تم تغيير اللغة إلى العربية. سيتم تطبيق التغيير.'
      : 'Language changed to English. Change will be applied.';

    await changeLanguage(next);
    Alert.alert(
      t('profile.langChangeTitle'),
      t('profile.langChangeMsg'),
      [{ text: t('profile.langRestart'), style: 'default' }],
    );
  }, [lang, changeLanguage, t]);

  return { t, lang, isRTL, ta, rowDir, changeLanguage, toggleLanguage };
}
