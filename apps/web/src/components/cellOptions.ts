export interface CellOption {
  readonly value: string;
  readonly label: string;
}

export const CELL_ICONS: readonly CellOption[] = [
  { value: '⭐', label: 'Estrella' },
  { value: '❤️', label: 'Corazón' },
  { value: '🏋️', label: 'Deporte' },
  { value: '📚', label: 'Lectura' },
  { value: '💻', label: 'Tecnología' },
  { value: '🎨', label: 'Arte' },
  { value: '🎵', label: 'Música' },
  { value: '🐾', label: 'Mascotas' },
  { value: '🛒', label: 'Compras' },
  { value: '🏠', label: 'Hogar' },
  { value: '✈️', label: 'Viajes' },
  { value: '🍽️', label: 'Comida' },
];

export const CELL_COLORS: readonly CellOption[] = [
  { value: '#F44336', label: 'Rojo' },
  { value: '#E91E63', label: 'Rosa' },
  { value: '#9C27B0', label: 'Morado' },
  { value: '#673AB7', label: 'Violeta' },
  { value: '#3F51B5', label: 'Índigo' },
  { value: '#2196F3', label: 'Azul' },
  { value: '#00BCD4', label: 'Cian' },
  { value: '#009688', label: 'Verde azulado' },
  { value: '#4CAF50', label: 'Verde' },
  { value: '#FFC107', label: 'Ámbar' },
  { value: '#FF9800', label: 'Naranja' },
];
