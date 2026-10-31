import {sql} from 'drizzle-orm';
import {sqliteTable, text, integer, index, uniqueIndex, check, customType} from 'drizzle-orm/sqlite-core';

// Better Auth's native D1/Kysely adapter stores dates as ISO strings, not millis.
const authDate=customType<{data:string;driverData:string}>({dataType:()=> 'date'});
export const user = sqliteTable('user', {
  id:text('id').primaryKey(), name:text('name').notNull(), email:text('email').notNull(),
  emailVerified:integer('emailVerified',{mode:'boolean'}).notNull().default(false), image:text('image'),
  createdAt:authDate('createdAt').notNull(), updatedAt:authDate('updatedAt').notNull(),
}, t => [uniqueIndex('user_email_unique').on(t.email)]);
export const session = sqliteTable('session', {
  id:text('id').primaryKey(), expiresAt:authDate('expiresAt').notNull(), token:text('token').notNull(),
  createdAt:authDate('createdAt').notNull(), updatedAt:authDate('updatedAt').notNull(), ipAddress:text('ipAddress'), userAgent:text('userAgent'),
  userId:text('userId').notNull().references(()=>user.id,{onDelete:'cascade'}),
}, t => [uniqueIndex('session_token_unique').on(t.token), index('session_userId_idx').on(t.userId)]);
export const account = sqliteTable('account', {
  id:text('id').primaryKey(), accountId:text('accountId').notNull(), providerId:text('providerId').notNull(),
  userId:text('userId').notNull().references(()=>user.id,{onDelete:'cascade'}), accessToken:text('accessToken'),refreshToken:text('refreshToken'),idToken:text('idToken'),
  accessTokenExpiresAt:authDate('accessTokenExpiresAt'),refreshTokenExpiresAt:authDate('refreshTokenExpiresAt'),scope:text('scope'),password:text('password'),
  createdAt:authDate('createdAt').notNull(),updatedAt:authDate('updatedAt').notNull(),
},t=>[index('account_userId_idx').on(t.userId),uniqueIndex('account_credential_unique').on(t.providerId,t.accountId)]);
export const verification = sqliteTable('verification',{
  id:text('id').primaryKey(),identifier:text('identifier').notNull(),value:text('value').notNull(),expiresAt:authDate('expiresAt').notNull(),createdAt:authDate('createdAt').notNull(),updatedAt:authDate('updatedAt').notNull(),
},t=>[index('verification_identifier_idx').on(t.identifier)]);
export const folioMembers = sqliteTable('folio_members',{
  userId:text('user_id').primaryKey().references(()=>user.id,{onDelete:'cascade'}),role:text('role').notNull(),status:text('status').notNull().default('active'),createdAt:integer('created_at').notNull(),
},t=>[check('folio_member_role',sql`${t.role} IN ('owner','member')`),check('folio_member_status',sql`${t.status} IN ('active','disabled')`),uniqueIndex('folio_one_owner').on(t.role).where(sql`${t.role} = 'owner'`)]);
export const folioTokens = sqliteTable('folio_tokens',{
  id:text('id').primaryKey(),tokenHash:text('token_hash').notNull(),kind:text('kind').notNull(),email:text('email').notNull(),userId:text('user_id').references(()=>user.id,{onDelete:'cascade'}),
  createdBy:text('created_by').references(()=>user.id,{onDelete:'cascade'}),createdAt:integer('created_at').notNull(),expiresAt:integer('expires_at').notNull(),consumedAt:integer('consumed_at'),
},t=>[uniqueIndex('folio_token_hash_unique').on(t.tokenHash),index('folio_token_target_idx').on(t.userId,t.kind),check('folio_token_kind',sql`${t.kind} IN ('invite','recovery')`)]);
export const folioLimits = sqliteTable('folio_limits',{
  key:text('key').primaryKey(),attempts:integer('attempts').notNull(),expiresAt:integer('expires_at').notNull(),
},t=>[index('folio_limit_expiry_idx').on(t.expiresAt)]);
export const folioDocuments = sqliteTable('folio_documents',{
  name:text('name').primaryKey(),revision:integer('revision').notNull(),data:text('data').notNull(),blobs:text('blobs').notNull(),updatedAt:integer('updated_at').notNull(),updatedBy:text('updated_by').notNull().references(()=>user.id),
},t=>[check('folio_document_name',sql`${t.name} IN ('library','icons','appearance')`),check('folio_document_revision',sql`${t.revision} > 0`)]);
export const folioBlobs = sqliteTable('folio_blobs',{
  hash:text('hash').primaryKey(),size:integer('size').notNull(),createdAt:integer('created_at').notNull(),createdBy:text('created_by').notNull().references(()=>user.id),
},t=>[check('folio_blob_size',sql`${t.size} >= 0 AND ${t.size} <= 8388608`)]);
