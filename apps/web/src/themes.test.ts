// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { BINGO_THEMES, type BingoTheme } from '@bingogoals/domain';
import globalCss from './index.css?raw';
import { THEMES } from './themes';
import themesCss from './themes.css?raw';

/** Contraste mínimo de WCAG AA para texto normal. */
const MIN_CONTRAST = 4.5;

function variable(css: string, name: string): string {
  const value = css.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
  if (!value) {
    throw new Error(`Falta la variable ${name}`);
  }
  return value;
}

function themeBlock(theme: BingoTheme): string {
  const block = themesCss.match(
    new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`),
  )?.[1];
  if (!block) {
    throw new Error(`Falta el tema ${theme} en themes.css`);
  }
  return block;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

const text = variable(globalCss, '--color-text');
const muted = variable(globalCss, '--color-muted');

describe('temas', () => {
  test('hay seis, cada uno con nombre e icono', () => {
    expect(BINGO_THEMES).toHaveLength(6);
    for (const theme of BINGO_THEMES) {
      expect(THEMES[theme].label).not.toBe('');
      expect(THEMES[theme].emoji).not.toBe('');
    }
  });

  test('se distinguen entre sí por color principal y fondo', () => {
    const primaries = BINGO_THEMES.map((theme) =>
      variable(themeBlock(theme), '--color-primary'),
    );
    const backgrounds = BINGO_THEMES.map((theme) =>
      variable(themeBlock(theme), '--color-background'),
    );

    expect(new Set(primaries).size).toBe(6);
    expect(new Set(backgrounds).size).toBe(6);
  });

  describe.each(BINGO_THEMES)('%s mantiene el contraste', (theme) => {
    const primary = variable(themeBlock(theme), '--color-primary');
    const background = variable(themeBlock(theme), '--color-background');

    test('texto blanco sobre el color principal', () => {
      expect(contrast('#ffffff', primary)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    });

    test('color principal sobre el fondo y sobre blanco', () => {
      expect(contrast(primary, background)).toBeGreaterThanOrEqual(
        MIN_CONTRAST,
      );
      expect(contrast(primary, '#ffffff')).toBeGreaterThanOrEqual(MIN_CONTRAST);
    });

    test('texto normal y secundario sobre el fondo', () => {
      expect(contrast(text, background)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrast(muted, background)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    });
  });
});
