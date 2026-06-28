/**
 * Migration runner for applying database schema updates
 * This script can be run independently to update an existing database
 * Usage: node src/db/runMigration.js
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('./timescale');

async function runMigration() {
  const migrationPath = path.join(__dirname, 'migrations', '001_add_sensor_constraints.sql');
  
  console.log('[Migration] Starting database migration...');
  
  const client = await pool.connect();
  try {
    // Read migration SQL file
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    await client.query(migrationSQL);
    
    console.log('[Migration] Successfully applied migration: 001_add_sensor_constraints.sql');
    console.log('[Migration] Database schema updated with CHECK constraints');
  } catch (error) {
    console.error('[Migration] Error applying migration:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration if executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('[Migration] Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Migration] Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
