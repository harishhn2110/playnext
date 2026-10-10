/* Lists: Want to Play, Completed and Cart persisted in localStorage. */
const Lists = (() => {
  const KEY = 'playnext.lists';
  const TYPES = ['want', 'completed', 'cart'];
  let store = read();
  const subs = [];

  function read() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null') || {};
      return { want: s.want || [], completed: s.completed || [], cart: s.cart || [] };
    } catch (e) { return { want: [], completed: [], cart: [] }; }
  }
  function write() { localStorage.setItem(KEY, JSON.stringify(store)); subs.forEach(fn => fn(store)); }

  const listOf = t => store[t] || (store[t] = []);
  function has(t, title) { return listOf(t).includes(title); }
  function add(t, title) { if (!has(t, title)) { listOf(t).push(title); write(); } }
  function remove(t, title) {
    const l = listOf(t), next = l.filter(x => x !== title);
    if (next.length !== l.length) { store[t] = next; write(); }
  }
  function toggle(t, title) { has(t, title) ? remove(t, title) : add(t, title); }
  function move(title, from, to) {
    remove(from, title);
    if (!has(to, title)) add(to, title);
  }
  function removeFromAll(title) { TYPES.forEach(t => remove(t, title)); }

  return {
    TYPES,
    all: () => store,
    list: t => listOf(t).slice(),
    has, add, remove, toggle, move, removeFromAll,
    counts: () => ({ want: store.want.length, completed: store.completed.length, cart: store.cart.length }),
    onChange: fn => { subs.push(fn); return () => subs.splice(subs.indexOf(fn), 1); }
  };
})();
