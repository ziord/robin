export type Scope<K, V> = {
  symbols: Map<K, V>;
  enclosingScope: Scope<K, V> | null;
};

export interface ScopeTable<K, V> {
  table: Scope<K, V>;
  insert(key: K, obj: V): boolean | V;
  lookup(key: K): V | undefined;
}

export function unreachable(...msg: string[]): never {
  console.warn("Reached unreachable - ", ...msg);
  throw new Error("Unreachable");
}
