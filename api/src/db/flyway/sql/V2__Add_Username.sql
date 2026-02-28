-- Add username column to the users table
-- We allow it to be nullable initially if there are existing records, 
-- but in our app logic we will require it for new signups.

ALTER TABLE users ADD COLUMN username VARCHAR(255);

-- In SQLite we can't easily add a UNIQUE constraint to an existing table directly
-- without recreating the table, but we can create a UNIQUE INDEX:
CREATE UNIQUE INDEX idx_users_username ON users(username);
