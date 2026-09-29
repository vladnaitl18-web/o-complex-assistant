import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { KnowledgeSchema, type Knowledge } from "../shared/schema";
import { initialKnowledge } from "../shared/seed";
export class StoreError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export class KnowledgeStore {
  private current: Knowledge = structuredClone(initialKnowledge);
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private file: string) {}
  async init() {
    await mkdir(path.dirname(this.file), { recursive: true });
    try {
      this.current = KnowledgeSchema.parse(
        JSON.parse(await readFile(this.file, "utf8")),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw new Error(
          "Не удалось прочитать базу знаний. Проверьте data/knowledge.json; файл не перезаписан.",
        );
      await this.persist(this.current);
    }
    return this;
  }
  get() {
    return structuredClone(this.current);
  }
  private async persist(kb: Knowledge) {
    const temp = `${this.file}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(kb, null, 2), { mode: 0o600 });
    await rename(temp, this.file);
  }
  async save(input: Knowledge): Promise<Knowledge> {
    const job = this.queue.then(async () => {
      if (input.revision !== this.current.revision)
        throw new StoreError(
          409,
          "База уже изменена. Обновите страницу и повторите изменения.",
        );
      const next = KnowledgeSchema.parse({
        ...input,
        revision: this.current.revision + 1,
      });
      await this.persist(next);
      this.current = next;
      return this.get();
    });
    this.queue = job.catch(() => {});
    return job;
  }
}
