-- Migration: Add CHECK constraints and proper data types to sensor_data_pcm table
-- This migration is idempotent and can be run multiple times safely

-- Step 1: Alter column types if needed (only if table exists)
DO $$
BEGIN
  -- Change temperature to NUMERIC(4,1) if it's not already
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sensor_data_pcm' 
    AND column_name = 'temperature' 
    AND data_type != 'numeric'
  ) THEN
    ALTER TABLE sensor_data_pcm ALTER COLUMN temperature TYPE NUMERIC(4,1);
  END IF;

  -- Change humidity to INTEGER if it's not already
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sensor_data_pcm' 
    AND column_name = 'humidity' 
    AND data_type != 'integer'
  ) THEN
    ALTER TABLE sensor_data_pcm ALTER COLUMN humidity TYPE INTEGER;
  END IF;

  -- Change current to NUMERIC(10,2) if it's not already
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sensor_data_pcm' 
    AND column_name = 'current' 
    AND data_type != 'numeric'
  ) THEN
    ALTER TABLE sensor_data_pcm ALTER COLUMN current TYPE NUMERIC(10,2);
  END IF;

  -- Change relay to VARCHAR(3) if it's not already
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sensor_data_pcm' 
    AND column_name = 'relay' 
    AND character_maximum_length != 3
  ) THEN
    ALTER TABLE sensor_data_pcm ALTER COLUMN relay TYPE VARCHAR(3);
  END IF;

  -- Change buzzer to VARCHAR(3) if it's not already
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sensor_data_pcm' 
    AND column_name = 'buzzer' 
    AND character_maximum_length != 3
  ) THEN
    ALTER TABLE sensor_data_pcm ALTER COLUMN buzzer TYPE VARCHAR(3);
  END IF;

  -- Change led to VARCHAR(6) if it's not already
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sensor_data_pcm' 
    AND column_name = 'led' 
    AND character_maximum_length != 6
  ) THEN
    ALTER TABLE sensor_data_pcm ALTER COLUMN led TYPE VARCHAR(6);
  END IF;
END $$;

-- Step 2: Add CHECK constraints (idempotent - will skip if already exists)
DO $$
BEGIN
  -- Temperature constraint: -50 to 100
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sensor_data_pcm_temperature_check'
  ) THEN
    ALTER TABLE sensor_data_pcm 
    ADD CONSTRAINT sensor_data_pcm_temperature_check 
    CHECK (temperature >= -50 AND temperature <= 100);
  END IF;

  -- Humidity constraint: 0 to 100
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sensor_data_pcm_humidity_check'
  ) THEN
    ALTER TABLE sensor_data_pcm 
    ADD CONSTRAINT sensor_data_pcm_humidity_check 
    CHECK (humidity >= 0 AND humidity <= 100);
  END IF;

  -- Current constraint: non-negative
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sensor_data_pcm_current_check'
  ) THEN
    ALTER TABLE sensor_data_pcm 
    ADD CONSTRAINT sensor_data_pcm_current_check 
    CHECK (current >= 0);
  END IF;

  -- Relay constraint: ON or OFF
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sensor_data_pcm_relay_check'
  ) THEN
    ALTER TABLE sensor_data_pcm 
    ADD CONSTRAINT sensor_data_pcm_relay_check 
    CHECK (relay IN ('ON', 'OFF'));
  END IF;

  -- Buzzer constraint: ON or OFF
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sensor_data_pcm_buzzer_check'
  ) THEN
    ALTER TABLE sensor_data_pcm 
    ADD CONSTRAINT sensor_data_pcm_buzzer_check 
    CHECK (buzzer IN ('ON', 'OFF'));
  END IF;

  -- LED constraint: RED, GREEN, or YELLOW
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sensor_data_pcm_led_check'
  ) THEN
    ALTER TABLE sensor_data_pcm 
    ADD CONSTRAINT sensor_data_pcm_led_check 
    CHECK (led IN ('RED', 'GREEN', 'YELLOW'));
  END IF;
END $$;
