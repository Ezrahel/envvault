import { pgTable, uuid, text, timestamp, integer, varchar, unique, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  // scrypt password hash (`scrypt$n$r$p$salt$hash`). Null for legacy passwordless accounts.
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 20 }).notNull(),
    host: varchar("host", { length: 255 }).notNull(),
    owner: varchar("owner", { length: 255 }),
    repository: varchar("repository", { length: 255 }).notNull(),
    canonicalRemote: varchar("canonical_remote", { length: 512 }).notNull(),
    providerRepositoryId: varchar("provider_repository_id", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    userCanonicalUnique: unique("user_canonical_unique").on(t.userId, t.canonicalRemote),
    canonicalIdx: index("projects_canonical_idx").on(t.canonicalRemote),
    providerIdIdx: index("projects_provider_id_idx").on(t.providerRepositoryId),
  }),
);

export const environments = pgTable(
  "environments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    projectNameUnique: unique("project_env_unique").on(t.projectId, t.name),
  }),
);

export const environmentFiles = pgTable(
  "environment_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environments.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    envFileUnique: unique("env_file_unique").on(t.environmentId, t.fileName),
  }),
);

export const secretVersions = pgTable("secret_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  environmentFileId: uuid("environment_file_id")
    .notNull()
    .references(() => environmentFiles.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  objectKey: text("object_key").notNull(),
  cipherAlgorithm: varchar("cipher_algorithm", { length: 50 }).notNull(),
  keyVersion: integer("key_version").notNull(),
  nonce: text("nonce").notNull(),
  // Envelope extras: ciphertext is the *encrypted* blob (never plaintext).
  // Object storage (R2) remains the primary ciphertext store; this column keeps
  // listVersions fast and provides a fallback copy.
  authTag: text("auth_tag"),
  ciphertext: text("ciphertext"),
  formatVersion: integer("format_version").default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => users.id),
});

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  platform: varchar("platform", { length: 50 }),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  projectId: uuid("project_id").references(() => projects.id),
  action: varchar("action", { length: 100 }).notNull(),
  deviceId: uuid("device_id").references(() => devices.id),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Revoked JWTs (logout / refresh rotation). Stateless JWT verification
// checks this table; rows can be pruned once past their `expiresAt`.
export const revokedTokens = pgTable("revoked_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  jti: varchar("jti", { length: 100 }).notNull().unique(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
