import { pgTable, text, integer, timestamp, primaryKey } from 'drizzle-orm/pg-core';

export const players = pgTable('players', {
  id: text('id').primaryKey(),
  gold: integer('gold').notNull().default(0),
  gems: integer('gems').notNull().default(0),
  bestScore: integer('best_score').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const runs = pgTable('runs', {
  id: text('id').primaryKey(),
  playerId: text('player_id').notNull().references(() => players.id),
  characterId: text('character_id').notNull(),
  seed: integer('seed').notNull(),
  score: integer('score').notNull().default(0),
  wave: integer('wave').notNull().default(0),
  kills: integer('kills').notNull().default(0),
  goldEarned: integer('gold_earned').notNull().default(0),
  gemsEarned: integer('gems_earned').notNull().default(0),
  status: text('status').notNull().default('ACTIVE'), // ACTIVE, COMPLETED, FAILED
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const bestiary = pgTable('bestiary', {
  playerId: text('player_id').notNull().references(() => players.id),
  enemyId: text('enemy_id').notNull(),
  kills: integer('kills').notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.playerId, table.enemyId] }),
]);

export const shopUpgrades = pgTable('shop_upgrades', {
  playerId: text('player_id').notNull().references(() => players.id),
  stat: text('stat').notNull(),
  level: integer('level').notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.playerId, table.stat] }),
]);
