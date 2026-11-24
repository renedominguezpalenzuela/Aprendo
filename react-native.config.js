/**
 * Declara assets/fonts como directorio de assets para que `npx react-native-asset`
 * copie las fuentes a android/app/src/main/assets/fonts/ y las registre en
 * UIAppFonts dentro de ios/Mason/Info.plist.
 *
 * Ver specs/features/splash-screen/design.md seccion 2.6.
 *
 * @format
 */

module.exports = {
  assets: ['./assets/fonts'],
};
