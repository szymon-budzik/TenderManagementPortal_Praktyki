import { Moon, Sun } from 'lucide-react';

export default function ThemeToggleButton({ isDark, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isDark ? 'Przełącz na motyw jasny' : 'Przełącz na motyw ciemny'}
      aria-label={isDark ? 'Przełącz na motyw jasny' : 'Przełącz na motyw ciemny'}
      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition cursor-pointer shrink-0 ${
        isDark
          ? 'bg-slate-800 hover:bg-slate-700 border-amber-400 text-amber-300'
          : 'bg-blue-50 hover:bg-blue-100 border-blue-600 text-black'
      }`}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
