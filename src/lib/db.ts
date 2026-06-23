import Database from "@tauri-apps/plugin-sql";

let _db: Database | null = null;
let _loading: Promise<Database> | null = null;

/** Conexao unica (singleton) com o SQLite local (hld.db no AppData). */
export async function getDb(): Promise<Database> {
  if (_db) return _db;
  if (!_loading) {
    _loading = Database.load("sqlite:hld.db").then((db) => {
      _db = db;
      return db;
    });
  }
  return _loading;
}

/** SELECT tipado. */
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  return db.select<T[]>(sql, params);
}

/** INSERT/UPDATE/DELETE. Retorna { rowsAffected, lastInsertId }. */
export async function exec(sql: string, params: unknown[] = []) {
  const db = await getDb();
  return db.execute(sql, params);
}
