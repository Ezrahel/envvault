export * from "./schema.js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 1 });
  return drizzle(client);
}
