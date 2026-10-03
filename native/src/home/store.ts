import { readHome, storageKey, type HomeData } from "./model.ts";
export interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export class HomeStore {
  readonly key: string;
  data: HomeData = { tasks: [], medications: [] };
  ready = false;
  error = "";
  saving = false;
  private queue: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  private storage: Storage;
  constructor(uid: string, storage: Storage) {
    this.storage = storage;
    this.key = storageKey(uid);
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private emit() {
    this.listeners.forEach((f) => f());
  }
  async load() {
    this.ready = false;
    this.error = "";
    this.emit();
    try {
      this.data = readHome(await this.storage.getItem(this.key));
      this.ready = true;
    } catch {
      this.error =
        "Your saved reminders could not be loaded. Please retry. They have not been replaced.";
    }
    this.emit();
  }
  change(update: (data: HomeData) => HomeData): Promise<boolean> {
    const job = this.queue.then(async () => {
      if (!this.ready) return false;
      this.saving = true;
      this.error = "";
      this.emit();
      try {
        const next = update(this.data);
        await this.storage.setItem(this.key, JSON.stringify(next));
        this.data = next;
        return true;
      } catch {
        this.error = "Your change could not be saved. Please try again.";
        return false;
      } finally {
        this.saving = false;
        this.emit();
      }
    });
    this.queue = job.then(() => {});
    return job;
  }
}
