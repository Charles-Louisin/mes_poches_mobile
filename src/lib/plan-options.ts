/**
 * Options de sélecteur pour poches et catégories : celles hors forfait (« locked » renvoyé par l'API)
 * restent visibles mais grisées avec le diamant, et ouvrent la proposition de palier supérieur.
 */
type Lockable = { _id: string; name: string; locked?: boolean };

export function walletOption(w: Lockable) {
  return { value: w._id, label: w.name, lockedKind: w.locked ? ('wallets' as const) : undefined };
}

export function categoryOption(c: Lockable) {
  return { value: c._id, label: c.name, lockedKind: c.locked ? ('categories' as const) : undefined };
}
