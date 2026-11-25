import { Plus } from 'lucide-react';

export default function UserCreateForm({ newUser, onChange, roles, onSubmit }) {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-white p-4 rounded-xl border border-blue-200 grid grid-cols-1 md:grid-cols-5 gap-3 items-end shadow-xs"
    >
      <div>
        <label className="block text-xs font-bold uppercase mb-1">Login</label>
        <input
          type="text"
          required
          value={newUser.username}
          onChange={(e) => onChange({ ...newUser, username: e.target.value })}
          className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black"
          placeholder="np. jkowalski"
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase mb-1">Email</label>
        <input
          type="email"
          required
          value={newUser.email}
          onChange={(e) => onChange({ ...newUser, email: e.target.value })}
          className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black"
          placeholder="jan@firma.pl"
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase mb-1">Hasło (min. 6 zn.)</label>
        <input
          type="password"
          required
          minLength={6}
          value={newUser.password}
          onChange={(e) => onChange({ ...newUser, password: e.target.value })}
          className="w-full px-3 py-2 border border-blue-300 rounded-lg text-black"
          placeholder="••••••••"
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase mb-1">Przypisz Rolę</label>
        <select
          value={newUser.role}
          onChange={(e) => onChange({ ...newUser, role: e.target.value })}
          className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-black font-semibold"
        >
          {roles.map((r) => (
            <option key={r.name} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="flex items-center justify-center gap-1.5 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
      >
        <Plus size={16} /> Dodaj użytkownika
      </button>
    </form>
  );
}
