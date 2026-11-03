// Synchronisation avec Supabase (REST + Auth), par simples fetch. Les identifiants restent hors des sauvegardes (clé studenthub:sync).
export const SYNC_KEY = 'studenthub:sync';
const blank = () => ({ url: '', anonKey: '', session: null, last: '' });

export function loadSync(storage) {
  try { const o = JSON.parse(storage.getItem(SYNC_KEY)); return { ...blank(), ...(o && typeof o === 'object' ? o : {}) }; } catch { return blank(); }
}
export const saveSync = (storage, cfg) => storage.setItem(SYNC_KEY, JSON.stringify(cfg));

// Seule une adresse https:// sans chemin ni identifiants est acceptée.
export function cleanUrl(u) {
  try { const x = new URL(String(u).trim()); return x.protocol === 'https:' && !x.username && !x.password ? x.origin : ''; } catch { return ''; }
}

const MESSAGES = {
  invalid_credentials: 'E-mail ou mot de passe incorrect.', email_not_confirmed: 'Confirme d\'abord ton adresse e-mail (lien reçu par courrier).',
  user_already_exists: 'Un compte existe déjà avec cet e-mail : connecte-toi.', weak_password: 'Mot de passe trop faible (6 caractères au minimum).',
  over_request_rate_limit: 'Trop de tentatives : attends un peu.', over_email_send_rate_limit: 'Trop d\'e-mails envoyés : attends un peu.',
};
function explain(status, body) {
  const code = body?.error_code ?? body?.code;
  if (MESSAGES[code]) return MESSAGES[code];
  if (status === 401 || status === 403) return 'Accès refusé : reconnecte-toi, ou vérifie la règle de sécurité de la table.';
  if (status === 404) return 'Table user_state introuvable : vérifie que tu as lancé le script SQL.';
  return String(body?.msg ?? body?.message ?? body?.error_description ?? body?.error ?? `Erreur ${status}`).slice(0, 200);
}

export function createClient({ url, anonKey, getSession, setSession, fetchFn = (...a) => fetch(...a), now = () => Date.now() }) {
  const base = cleanUrl(url);
  if (!base) throw new Error('L\'adresse du projet doit commencer par https:// (ex. https://abcd.supabase.co).');
  if (!String(anonKey).trim()) throw new Error('Renseigne la clé « anon public » du projet.');
  async function call(path, { method = 'GET', body, token, headers = {} } = {}) {
    let res;
    try {
      res = await fetchFn(`${base}${path}`, {
        method, headers: { apikey: anonKey, Authorization: `Bearer ${token ?? anonKey}`, 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch { throw new Error('Connexion impossible : vérifie le réseau et l\'adresse du projet.'); }
    const text = await res.text(); let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* réponse non JSON */ }
    if (!res.ok) throw new Error(explain(res.status, data));
    return data;
  }
  const toSession = (d) => ({
    access_token: d.access_token, refresh_token: d.refresh_token,
    expires_at: d.expires_at ? d.expires_at * 1000 : now() + (d.expires_in ?? 3600) * 1000, user: { id: d.user?.id, email: d.user?.email },
  });
  async function token() {
    let s = getSession();
    if (!s?.access_token) throw new Error('Connecte-toi d\'abord.');
    if (s.expires_at - 60000 < now()) {
      const d = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } });
      s = toSession(d); setSession(s);
    }
    return s;
  }
  return {
    async signUp(email, password) {
      const d = await call('/auth/v1/signup', { method: 'POST', body: { email, password } });
      if (d?.access_token) { const s = toSession(d); setSession(s); return { session: s }; }
      return { needsConfirm: true };
    },
    async signIn(email, password) {
      const s = toSession(await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } }));
      setSession(s); return s;
    },
    async pull() {
      const s = await token();
      const rows = await call(`/rest/v1/user_state?select=data,updated_at&user_id=eq.${encodeURIComponent(s.user.id)}`, { token: s.access_token });
      return Array.isArray(rows) && rows[0] ? rows[0] : null;
    },
    async push(data) {
      const s = await token();
      await call('/rest/v1/user_state', {
        method: 'POST', token: s.access_token, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: { user_id: s.user.id, data, updated_at: new Date(now()).toISOString() },
      });
    },
    async signOut() {
      const s = getSession();
      if (s?.access_token) { try { await call('/auth/v1/logout', { method: 'POST', token: s.access_token }); } catch { /* la déconnexion locale suffit */ } }
      setSession(null);
    },
  };
}

// Scénarios de synchronisation (sans interface, donc testables).
export async function syncNow(client, store) {
  const row = await client.pull();
  let merged = 0;
  if (row?.data) { const res = store.importFile(JSON.stringify(row.data), { mode: 'merge' }); merged = Object.values(res.counts ?? res ?? {}).reduce((a, n) => a + (Number(n) || 0), 0); }
  await client.push(JSON.parse(store.exportJSON()));
  return { merged, hadCloud: !!row };
}
export async function replaceCloud(client, store) { await client.push(JSON.parse(store.exportJSON())); }
export async function replaceDevice(client, store) {
  const row = await client.pull();
  if (!row?.data) throw new Error('Le cloud est vide : rien à récupérer.');
  store.importFile(JSON.stringify(row.data), { mode: 'replace' });
}
