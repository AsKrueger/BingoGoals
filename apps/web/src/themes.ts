import type { BingoTheme } from './domain';

interface ThemeInfo {
  readonly label: string;
  readonly emoji: string;
}

/** Nombre e icono de cada tema. Los colores están en themes.css. */
export const THEMES: Record<BingoTheme, ThemeInfo> = {
  classic: { label: 'Clásico', emoji: '⭐' },
  christmas: { label: 'Navidad', emoji: '❄️' },
  sakura: { label: 'Sakura', emoji: '🌸' },
  spring: { label: 'Primavera', emoji: '🌱' },
  newYear: { label: 'Año Nuevo', emoji: '🎆' },
  birthday: { label: 'Cumpleaños', emoji: '🎂' },
};
