import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';

export const mediaFiles = sqliteTable('media_files', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    filepath: text('filepath').notNull().unique(),
    filename: text('filename').notNull(),
    type: text('type').notNull(), // 'image', 'video', 'audio', 'project', 'document'
    size: integer('size'),
    createdAt: integer('created_at'),
    hash: text('hash'),
    metadata: text('metadata', { mode: 'json' }),
});

export const thumbnails = sqliteTable('thumbnails', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    mediaId: integer('media_id').references(() => mediaFiles.id, { onDelete: 'cascade' }),
    data: blob('data', { mode: 'buffer' }).notNull(), // Using Base64 string for simplicity in typical SQLite, or Buffer if using specialized drivers. 
    // better-sqlite3 handles Buffers as Blobs. Let's use 'blob' type in Drizzle if available, or 'custom' 
    // actually, let's use 'blob' mode for text or just Buffer.
    format: text('format').notNull(), // 'webp'
});

export const userSettings = sqliteTable('user_settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
});

export const lifeStages = sqliteTable('life_stages', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    color: text('color').notNull(), // Hex
    startAge: integer('start_age').notNull(),
    endAge: integer('end_age').notNull(),
    visible: integer('visible', { mode: 'boolean' }).default(true),
});
