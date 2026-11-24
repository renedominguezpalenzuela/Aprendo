/**
 * Tests del contenido del mazo de ejemplo.
 *
 * El test de paridad es el cerrojo de DD-022: el CSV publicado en el repo y la
 * copia que viaja en la app tienen que decir exactamente lo mismo. Se lee el CSV
 * con el MISMO parser que usa la app para las hojas de Google, asi que lo que se
 * compara es lo que la app veria si el usuario importara ese CSV.
 *
 * Cubre EJEMPLO-002 del delta mazo-de-ejemplo.
 *
 * @format
 */

import fs from 'fs';
import path from 'path';

import {parseCsv} from '../src/decks/csv';
import {resolveColumns, toQuestions} from '../src/decks/deckSheet';
import {EXAMPLE_NAME, EXAMPLE_QUESTIONS} from '../src/sources/exampleDeck';
import {validateName} from '../src/sources/sourceUrl';

const CSV_PATH = path.join(__dirname, '..', 'ejemplos', 'sistema-solar.csv');

/** Las preguntas del CSV, tal como las leeria la app. */
function questionsFromCsv() {
  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  const resolved = resolveColumns(rows[0]);

  expect(resolved.ok).toBe(true);

  const {questions, warnings} = toQuestions(rows, resolved.columns);

  // Una fila descartada en el CSV seria una pregunta que la app tiene y el
  // ejemplo publicado no: tambien es divergencia.
  expect(warnings).toEqual([]);

  return questions;
}

describe('mazo de ejemplo', () => {
  it('se llama "Ejemplo: El sistema solar" y es un nombre valido', () => {
    expect(EXAMPLE_NAME).toBe('Ejemplo: El sistema solar');
    expect(validateName(EXAMPLE_NAME)).toEqual({ok: true, name: EXAMPLE_NAME});
  });

  it('trae 20 preguntas, con answer2 null y no vacio cuando no hay', () => {
    expect(EXAMPLE_QUESTIONS).toHaveLength(20);

    EXAMPLE_QUESTIONS.forEach(item => {
      expect(item.question.trim()).not.toBe('');
      expect(item.answer1.trim()).not.toBe('');
      expect(item.answer2 === null || item.answer2.trim() !== '').toBe(true);
    });
  });

  it('dice exactamente lo mismo que ejemplos/sistema-solar.csv (DD-022)', () => {
    const fromCsv = questionsFromCsv().map(({question, answer1, answer2}) => ({
      question,
      answer1,
      answer2,
    }));

    expect(EXAMPLE_QUESTIONS).toEqual(fromCsv);
  });

  it('el CSV no trae imagenes: el ejemplo no tiene donde guardarlas', () => {
    questionsFromCsv().forEach(item => {
      expect(item.imageQuestionUrl).toBeNull();
      expect(item.imageAnswerUrl).toBeNull();
    });
  });
});
