import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import fr from './fr.json'
import it from './it.json'
import es from './es.json'
import de from './de.json'

const savedLocale = localStorage.getItem('locale') || 'fr'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      it: { translation: it },
      es: { translation: es },
      de: { translation: de }
    },
    lng: savedLocale,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  })

export default i18n
