// Mise en forme des nombres et du texte, partagée par le domaine et l'interface.
export const fmt = (x, d = 0) => Number.isFinite(x) ? (+x.toFixed(d) || 0).toFixed(d).replace('.', ',').replace('-', '−') : '—';
// min/km → « m:ss » (5,995 → 6:00, pas 5:60)
export const pace = (p) => { if (!Number.isFinite(p)) return '—'; const s = Math.round(p * 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// valeur et unité : « 11° » collé, « 284 ms » espacé
export const fu = (x, u, d = 0) => `${fmt(x, d)}${u === '°' ? '' : ' '}${u}`;
