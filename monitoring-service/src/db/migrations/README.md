# Database Migrations

This directory contains SQL migration scripts for the monitoring-service database schema.

## Available Migrations

### 001_add_sensor_constraints.sql

Adds CHECK constraints and updates data types for the `sensor_data_pcm` table to ensure data integrity.

**Changes:**
- Updates `temperature` column to `NUMERIC(4,1)` with CHECK constraint (-50 to 100)
- Updates `humidity` column to `INTEGER` with CHECK constraint (0 to 100)
- Updates `current` column to `NUMERIC(10,2)` with CHECK constraint (>= 0)
- Updates `relay` column to `VARCHAR(3)` with CHECK constraint ('ON' or 'OFF')
- Updates `buzzer` column to `VARCHAR(3)` with CHECK constraint ('ON' or 'OFF')
- Updates `led` column to `VARCHAR(6)` with CHECK constraint ('RED', 'GREEN', or 'YELLOW')

**Idempotency:** This migration is idempotent and can be run multiple times safely. It checks for existing constraints before adding them.

## Running Migrations

### Option 1: Automatic (on service startup)

The `initializeDatabase()` function in `src/db/timescale.js` automatically applies the schema updates when the service starts.

```bash
npm start
```

### Option 2: Manual (standalone script)

Run the migration script directly:

```bash
node src/db/runMigration.js
```

### Option 3: Direct SQL execution

Connect to your TimescaleDB instance and execute the migration file:

```bash
psql -h localhost -U sparklock -d sparklock_monitoring -f src/db/migrations/001_add_sensor_constraints.sql
```

## Migration Safety

All migrations in this directory are designed to be:
- **Idempotent**: Can be run multiple times without errors
- **Non-destructive**: Do not drop or truncate existing data
- **Backward compatible**: Existing code continues to work during migration

## Troubleshooting

If you encounter constraint violations during migration, it means existing data doesn't meet the new constraints. You'll need to:

1. Review the existing data that violates constraints
2. Clean or update the invalid data
3. Re-run the migration

Example query to find invalid data:

```sql
-- Find temperature values out of range
SELECT * FROM sensor_data_pcm WHERE temperature < -50 OR temperature > 100;

-- Find humidity values out of range
SELECT * FROM sensor_data_pcm WHERE humidity < 0 OR humidity > 100;

-- Find negative current values
SELECT * FROM sensor_data_pcm WHERE current < 0;

-- Find invalid relay states
SELECT * FROM sensor_data_pcm WHERE relay NOT IN ('ON', 'OFF');

-- Find invalid buzzer states
SELECT * FROM sensor_data_pcm WHERE buzzer NOT IN ('ON', 'OFF');

-- Find invalid LED states
SELECT * FROM sensor_data_pcm WHERE led NOT IN ('RED', 'GREEN', 'YELLOW');
```
