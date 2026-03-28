/** Midnight Editorial design system — color tokens */
export const colors = {
  background:                '#131313',
  surfaceContainerLowest:    '#0e0e0e',
  surfaceContainerLow:       '#1c1b1b',
  surfaceContainer:          '#201f1f',
  surfaceContainerHigh:      '#2a2a2a',
  surfaceContainerHighest:   '#353534',
  onSurface:                 '#e5e2e1',
  onSurfaceVariant:          '#c2c6d4',
  primary:                   '#a8c8ff',
  onPrimary:                 '#003062',
  primaryContainer:          '#005fb8',
  secondary:                 '#b2c7f0',
  outline:                   '#8c919d',
  outlineVariant:            '#424752',
  tertiary:                  '#ffb691',
  error:                     '#ffb4ab',
} as const;

export type ColorToken = keyof typeof colors;
