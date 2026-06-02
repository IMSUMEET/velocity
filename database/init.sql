CREATE EXTENSION IF NOT EXISTS postgis;

-- Drivers table
CREATE TABLE IF NOT EXISTS driver (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    vehicle_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'IDLE',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOMETRY(Point, 4326),
    current_order_id BIGINT,
    speed DOUBLE PRECISION DEFAULT 0.0,
    rating DOUBLE PRECISION DEFAULT 4.5
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicle (
    id BIGSERIAL PRIMARY KEY,
    driver_id BIGINT REFERENCES driver(id),
    type VARCHAR(20) NOT NULL,
    license_plate VARCHAR(20),
    color VARCHAR(30)
);

-- Restaurants table
CREATE TABLE IF NOT EXISTS restaurant (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOMETRY(Point, 4326),
    category VARCHAR(50),
    rating DOUBLE PRECISION DEFAULT 4.0
);

-- Customers table
CREATE TABLE IF NOT EXISTS customer (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOMETRY(Point, 4326),
    address VARCHAR(200)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    restaurant_name VARCHAR(100) NOT NULL,
    pickup_lat DOUBLE PRECISION NOT NULL,
    pickup_lng DOUBLE PRECISION NOT NULL,
    dropoff_lat DOUBLE PRECISION NOT NULL,
    dropoff_lng DOUBLE PRECISION NOT NULL,
    pickup_location GEOMETRY(Point, 4326),
    dropoff_location GEOMETRY(Point, 4326),
    status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
    priority INTEGER DEFAULT 1,
    estimated_value DOUBLE PRECISION DEFAULT 15.0,
    driver_id BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    assigned_at TIMESTAMP,
    picked_up_at TIMESTAMP,
    delivered_at TIMESTAMP
);

-- Delivery assignments table
CREATE TABLE IF NOT EXISTS delivery_assignment (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT,
    driver_id BIGINT,
    score DOUBLE PRECISION NOT NULL,
    reason TEXT,
    distance DOUBLE PRECISION,
    eta DOUBLE PRECISION,
    assigned_at TIMESTAMP DEFAULT NOW()
);

-- Delivery events table
CREATE TABLE IF NOT EXISTS delivery_event (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT,
    driver_id BIGINT,
    event_type VARCHAR(50) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Demand zones table
CREATE TABLE IF NOT EXISTS demand_zone (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    center_lat DOUBLE PRECISION NOT NULL,
    center_lng DOUBLE PRECISION NOT NULL,
    center_location GEOMETRY(Point, 4326),
    radius DOUBLE PRECISION DEFAULT 1000,
    order_count INTEGER DEFAULT 0,
    intensity VARCHAR(20) DEFAULT 'LOW',
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for geospatial queries
CREATE INDEX IF NOT EXISTS idx_driver_location ON driver USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_restaurant_location ON restaurant USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_location ON orders USING GIST (pickup_location);
CREATE INDEX IF NOT EXISTS idx_orders_dropoff_location ON orders USING GIST (dropoff_location);
CREATE INDEX IF NOT EXISTS idx_driver_status ON driver (status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);

-- Trigger to auto-update location geometry columns
CREATE OR REPLACE FUNCTION update_driver_location() RETURNS TRIGGER AS $$
BEGIN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_driver_location ON driver;
CREATE TRIGGER trigger_update_driver_location
    BEFORE INSERT OR UPDATE OF latitude, longitude ON driver
    FOR EACH ROW EXECUTE FUNCTION update_driver_location();

CREATE OR REPLACE FUNCTION update_restaurant_location() RETURNS TRIGGER AS $$
BEGIN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_restaurant_location ON restaurant;
CREATE TRIGGER trigger_update_restaurant_location
    BEFORE INSERT OR UPDATE OF latitude, longitude ON restaurant
    FOR EACH ROW EXECUTE FUNCTION update_restaurant_location();

CREATE OR REPLACE FUNCTION update_order_locations() RETURNS TRIGGER AS $$
BEGIN
    NEW.pickup_location = ST_SetSRID(ST_MakePoint(NEW.pickup_lng, NEW.pickup_lat), 4326);
    NEW.dropoff_location = ST_SetSRID(ST_MakePoint(NEW.dropoff_lng, NEW.dropoff_lat), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_order_locations ON orders;
CREATE TRIGGER trigger_update_order_locations
    BEFORE INSERT OR UPDATE OF pickup_lat, pickup_lng, dropoff_lat, dropoff_lng ON orders
    FOR EACH ROW EXECUTE FUNCTION update_order_locations();
