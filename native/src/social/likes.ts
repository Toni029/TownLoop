export interface LikeStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}
/** Local reaction membership follows the web data model; totals remain in Firestore. */
export class LikeStore {
  readonly key: string;
  values = new Set<string>();
  ready = false;
  error = "";
  dirty = false;
  private listeners = new Set<() => void>();
  private storage: LikeStorage;
  constructor(uid: string, storage: LikeStorage) {
    this.storage = storage;
    this.key = `townloop:social:liked:${uid}`;
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private notify() {
    this.listeners.forEach((fn) => fn());
  }
  async load() {
    try {
      const raw = await this.storage.getItem(this.key);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed) || parsed.some((v) => typeof v !== "string"))
        throw Error();
      this.values = new Set(parsed);
      this.ready = true;
      this.error = "";
    } catch {
      this.error = "Unable to load your saved reactions. Please try again.";
    }
    this.notify();
  }
  async save(id: string, liked: boolean) {
    if (!this.ready) throw Error("Your reactions are still loading.");
    if (liked) this.values.add(id);
    else this.values.delete(id);
    this.dirty = true;
    await this.persist();
  }
  private async persist() {
    try {
      await this.storage.setItem(this.key, JSON.stringify([...this.values]));
      this.dirty = false;
      this.error = "";
    } catch {
      this.error =
        "Your reaction was saved online, but this device could not remember it. Please retry saving.";
    }
    this.notify();
  }
  async retry() {
    if (this.dirty) await this.persist();
    else await this.load();
  }
}
