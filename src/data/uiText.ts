/** Small interface-text dictionary for reusable controls. The editor currently ships in English. */
export const uiText = {
  en: {
    datePicker: {
      chooseMonth: 'Choose month',
      previousYear: 'Previous year',
      nextYear: 'Next year',
      selectMonth: (month: string, year: number) => `Select ${month} ${year}`,
    },
    colorPicker: {
      invalidColor: 'Enter a HEX, RGB, or HSL color.',
      hint: 'Pick a color or enter HEX, RGB, or HSL. Light shades are darkened for print readability.',
    },
  },
  es: {
    datePicker: {
      chooseMonth: 'Elegir mes',
      previousYear: 'Año anterior',
      nextYear: 'Año siguiente',
      selectMonth: (month: string, year: number) => `Seleccionar ${month} de ${year}`,
    },
    colorPicker: {
      invalidColor: 'Escribe un color HEX, RGB o HSL válido.',
      hint: 'Elige un color o escribe HEX, RGB o HSL. Los tonos claros se oscurecen para facilitar la lectura impresa.',
    },
  },
} as const

export type UiLocale = keyof typeof uiText

export function getUiLocale(): UiLocale {
  return typeof document !== 'undefined' && document.documentElement.lang.toLowerCase().startsWith('es') ? 'es' : 'en'
}
