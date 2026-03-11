-- =============================================================
-- TIER 3 — Azure SQL Database Setup
-- Run this in Azure Portal → SQL Database → Query Editor
-- Login: sqladmin / P@ssw0rd1234!
-- =============================================================

-- Create tasks table
IF NOT EXISTS (
  SELECT * FROM sysobjects WHERE name='tasks' AND xtype='U'
)
CREATE TABLE tasks (
  id        INT IDENTITY(1,1) PRIMARY KEY,
  text      NVARCHAR(500)     NOT NULL,
  done      BIT               NOT NULL DEFAULT 0,
  createdAt DATETIME          NOT NULL DEFAULT GETDATE()
);

-- Insert sample tasks to verify it works
INSERT INTO tasks (text) VALUES ('Buy groceries');
INSERT INTO tasks (text) VALUES ('Read a book');
INSERT INTO tasks (text) VALUES ('Deploy 3-tier app on Azure!');

-- Verify
SELECT * FROM tasks;
-- Expected: 3 rows returned
