export const DEFAULT_CATEGORY_COLOR = '#93c5fd';

export const CATEGORY_COLOR_PRESETS = [
  { hex: '#93c5fd', label: 'Niebieski (domyślny)', dark: false },
  { hex: '#fef08a', label: 'Żółty', dark: false },
  { hex: '#a7f3d0', label: 'Zielony', dark: false },
  { hex: '#ddd6fe', label: 'Fioletowy', dark: false },
  { hex: '#fecdd3', label: 'Różowy', dark: false },
  { hex: '#fed7aa', label: 'Pomarańczowy', dark: false },
  { hex: '#1d4ed8', label: 'Ciemnoniebieski', dark: true },
  { hex: '#065f46', label: 'Ciemnozielony', dark: true },
  { hex: '#6d28d9', label: 'Ciemnofioletowy', dark: true },
  { hex: '#9f1239', label: 'Bordowy', dark: true },
  { hex: '#1e293b', label: 'Grafitowy', dark: true },
];

export function getCategoryHighlightStyle(color, lightText = false) {
  const bg = color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color.trim())
    ? color.trim()
    : DEFAULT_CATEGORY_COLOR;
  return {
    backgroundColor: bg,
    color: lightText ? '#ffffff' : '#000000',
    borderColor: lightText ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)',
  };
}
