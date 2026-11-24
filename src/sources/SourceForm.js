/**
 * Formulario de alta y de edicion de una fuente.
 *
 * El mismo componente sirve para las dos cosas: con `initial` arranca relleno;
 * sin ella, vacio. La accion dice Guardar en los dos casos. Son el mismo formulario
 * con los mismos campos y las mismas validaciones, y duplicarlo solo garantizaba
 * que las validaciones se separasen con el tiempo.
 *
 * Ver specs/features/data-sources/design.md seccion 2.9 y DD-010.
 *
 * @format
 */

import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';

import {COLOR, LAYOUT, TYPE} from '../theme/masonTheme';
import {
  FORM,
  NAME_ERROR,
  SUBMIT_ERROR,
  SUBMIT_ERROR_FALLBACK,
  URL_ERROR,
} from './sourcesCopy';
import {
  MAX_NAME_LENGTH,
  MAX_URL_LENGTH,
  validateName,
  validateSheetUrl,
} from './sourceUrl';

/**
 * @param {Object} props
 * @param {import('./sourcesRepo').Source | null} [props.initial]
 * @param {(input: {name: string, url: string}) => {ok: boolean, reason?: string}} props.onSubmit
 *   Devuelve el resultado del repositorio: la unicidad del nombre no se puede
 *   comprobar aca, solo la impone la base (DD-007).
 * @param {() => void} [props.onCancel]  Si llega, se ofrece Cancelar, en alta
 *   y en edicion. Quien decide si se puede cancelar es la pantalla (DELTA-004).
 * @param {boolean} [props.autoFocus]  Enfoca el nombre al montar (DD-018).
 * @returns {React.ReactElement}
 */
export function SourceForm({initial = null, onSubmit, onCancel, autoFocus = false}) {
  const isEditing = initial != null;

  const [name, setName] = useState(initial?.name ?? '');
  const [url, setUrl] = useState(initial?.urlOriginal ?? '');
  const [errors, setErrors] = useState({name: null, url: null});
  const [focused, setFocused] = useState(null);

  // Al pasar a editar OTRA fuente, el formulario tiene que recargarse. Sin esto,
  // tocar Editar en una segunda fila dejaria los datos de la primera.
  //
  // La dependencia es el ID y NO el objeto `initial`: el store publica un
  // snapshot nuevo en cada refresco, asi que las fuentes son objetos nuevos
  // aunque no hayan cambiado. Dependiendo del objeto, cualquier refresco
  // borraria lo que el usuario esta escribiendo.
  const initialId = initial?.id ?? null;

  useEffect(() => {
    setName(initial?.name ?? '');
    setUrl(initial?.urlOriginal ?? '');
    setErrors({name: null, url: null});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  const handleSubmit = () => {
    const checkedName = validateName(name);
    const checkedUrl = validateSheetUrl(url);

    // Se validan LOS DOS aunque el primero falle: enterarse de un error por
    // pulsacion es una forma lenta y humillante de rellenar un formulario.
    if (!checkedName.ok || !checkedUrl.ok) {
      setErrors({
        name: checkedName.ok ? null : NAME_ERROR[checkedName.reason],
        url: checkedUrl.ok ? null : URL_ERROR[checkedUrl.reason],
      });
      return;
    }

    const result = onSubmit({name: checkedName.name, url: checkedUrl.url});

    if (result != null && result.ok === false) {
      // Motivos que no se pueden anticipar sin tocar la base. NINGUNO puede
      // quedarse sin mensaje: un fallo mudo deja al usuario pulsando un boton
      // que aparentemente no hace nada.
      const message =
        NAME_ERROR[result.reason] ??
        SUBMIT_ERROR[result.reason] ??
        SUBMIT_ERROR_FALLBACK;

      setErrors({name: message, url: null});
      return;
    }

    setErrors({name: null, url: null});

    // Solo se vacia si fue bien (REQ-016). Si fallo, se conserva lo escrito:
    // perderlo por un nombre duplicado seria castigar al usuario por un error
    // que se arregla cambiando una palabra.
    if (!isEditing) {
      setName('');
      setUrl('');
    }
  };

  return (
    <View style={styles.form}>
      <Field
        label={FORM.nameLabel}
        placeholder={FORM.namePlaceholder}
        value={name}
        onChangeText={setName}
        onFocus={() => setFocused('name')}
        onBlur={() => setFocused(null)}
        isFocused={focused === 'name'}
        error={errors.name}
        maxLength={MAX_NAME_LENGTH}
        autoFocus={autoFocus}
        autoCapitalize="sentences"
      />

      <Field
        label={FORM.urlLabel}
        placeholder={FORM.urlPlaceholder}
        value={url}
        onChangeText={setUrl}
        onFocus={() => setFocused('url')}
        onBlur={() => setFocused(null)}
        isFocused={focused === 'url'}
        error={errors.url}
        maxLength={MAX_URL_LENGTH}
        // Sin esto, el teclado de iOS capitaliza y autocorrige lo pegado y la
        // URL entra deformada.
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
      />

      <View style={styles.actions}>
        <Pressable
          onPress={handleSubmit}
          accessibilityRole="button"
          accessibilityLabel={FORM.submit}
          style={({pressed}) => [styles.submit, pressed && styles.pressed]}>
          <Text style={styles.submitLabel}>{FORM.submit.toUpperCase()}</Text>
        </Pressable>

        {onCancel != null && (
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel={FORM.cancel}
            style={({pressed}) => [styles.cancel, pressed && styles.pressed]}>
            <Text style={styles.cancelLabel}>{FORM.cancel.toUpperCase()}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * Boton que despliega el formulario de alta (DELTA-001, DELTA-002).
 *
 * Vive aca porque comparte el aspecto de la accion principal del formulario, y
 * ocupa su mismo sitio: con el mismo margen que el formulario, el boton queda
 * donde aparecera Guardar y la lista no salta de lado al desplegar.
 *
 * `expanded: false` le dice al lector de pantalla que despliega algo. Una vez
 * desplegado el boton deja de existir, y el anuncio lo da el foco en el campo
 * nombre (DD-018).
 *
 * @param {{onPress: () => void}} props
 * @returns {React.ReactElement}
 */
export function AddSourceButton({onPress}) {
  return (
    <View style={styles.collapsed}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={FORM.open}
        accessibilityHint={FORM.openHint}
        accessibilityState={{expanded: false}}
        style={({pressed}) => [styles.submit, pressed && styles.pressed]}>
        <Text style={styles.submitLabel}>{FORM.open.toUpperCase()}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Un campo con su etiqueta y su mensaje de error.
 *
 * El error se asocia al campo con `accessibilityLabel`, y no solo se pinta
 * debajo: un lector de pantalla que anuncia "Nombre" y, tres elementos despues,
 * un texto suelto de error, no comunica cual de los dos campos falla (REQ-055).
 *
 * @param {Object} props
 * @returns {React.ReactElement}
 */
function Field({label, error, isFocused, ...input}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>

      <TextInput
        {...input}
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          error != null && styles.inputError,
        ]}
        placeholderTextColor={COLOR.placeholder}
        accessibilityLabel={error == null ? label : `${label}. ${error}`}
        // Multilinea: una URL de Sheets no cabe en una linea y truncarla impide
        // comprobar lo que se ha pegado.
        multiline={input.keyboardType === 'url'}
      />

      {error != null && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 18,
    gap: 18,
  },
  collapsed: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 18,
  },
  field: {
    gap: 7,
  },
  label: TYPE.fieldLabel,
  input: {
    ...TYPE.fieldText,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLOR.field,
    borderWidth: 1,
    borderColor: COLOR.fieldBorder,
    borderRadius: LAYOUT.radiusSurface,
  },
  inputFocused: {
    borderColor: COLOR.fieldBorderFocus,
  },
  inputError: {
    borderColor: COLOR.fieldBorderError,
  },
  error: TYPE.fieldError,
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  submit: {
    paddingVertical: 13,
    paddingHorizontal: 22,
    backgroundColor: COLOR.buttonPrimary,
    borderRadius: LAYOUT.radiusControl,
  },
  submitLabel: {
    ...TYPE.button,
    color: COLOR.buttonPrimaryInk,
  },
  cancel: {
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: COLOR.buttonGhostBorder,
    borderRadius: LAYOUT.radiusControl,
  },
  cancelLabel: {
    ...TYPE.button,
    color: COLOR.inkDim,
  },
  pressed: {
    opacity: 0.85,
  },
});
