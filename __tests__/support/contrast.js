/**
 * Contraste de color segun WCAG 2.1.
 *
 * Vive en los tests y NO en `src/`: la app no calcula contrastes en tiempo de ejecucion,
 * asi que meterlo en `src/theme/` seria codigo de produccion que nadie llama. Ver
 * design.md DD-025.
 *
 * @format
 */

/**
 * Componente de color de 0..255 a su valor linealizado de 0..1.
 *
 * El 0.03928 y el 2.4 no son arbitrarios: son la curva de transferencia de sRGB, y la
 * formula de WCAG los exige tal cual. Ver https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 *
 * @param {number} value  Componente de 0 a 255.
 * @returns {number}
 */
function linearize(value) {
  const channel = value / 255;

  return channel <= 0.03928
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/**
 * Luminancia relativa de un color hexadecimal.
 *
 * @param {string} hex  `#RRGGBB`, con o sin almohadilla. No admite `#RGB` ni alfa: la
 *   paleta no los usa, y aceptarlos en silencio daria un numero plausible y equivocado.
 * @returns {number} 0 (negro) a 1 (blanco).
 */
export function luminance(hex) {
  const digits = hex.replace('#', '');

  if (!/^[0-9a-fA-F]{6}$/.test(digits)) {
    throw new Error(`contrast: se esperaba #RRGGBB y llego "${hex}"`);
  }

  const [red, green, blue] = [0, 2, 4].map(offset =>
    linearize(parseInt(digits.slice(offset, offset + 2), 16)),
  );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/**
 * Razon de contraste entre dos colores.
 *
 * Simetrica: el orden de los argumentos no importa, porque la formula ordena por
 * luminancia. Eso evita que una tabla de pares tenga que acordarse de poner el claro
 * primero.
 *
 * @param {string} a  `#RRGGBB`
 * @param {string} b  `#RRGGBB`
 * @returns {number} 1 (identicos) a 21 (negro sobre blanco).
 */
export function contrastRatio(a, b) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort(
    (first, second) => second - first,
  );

  return (lighter + 0.05) / (darker + 0.05);
}
