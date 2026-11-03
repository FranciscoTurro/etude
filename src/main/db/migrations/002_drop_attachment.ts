import type { Migration } from './index'

// Exercises no longer have attachments. Databases created before this still have
// the table; new ones never get it (it was removed from 001), hence IF EXISTS.
export const dropAttachment: Migration = {
  version: 2,
  name: 'drop_attachment',
  up: `DROP TABLE IF EXISTS Attachment;`
}
