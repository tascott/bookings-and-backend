-- 1) SITES
CREATE TABLE sites (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100)       NOT NULL,
  address       TEXT,
  is_active     BOOLEAN            DEFAULT TRUE
);

-- 2) FIELDS
CREATE TABLE fields (
  id            SERIAL PRIMARY KEY,
  site_id       INT                NOT NULL
                               REFERENCES sites(id),
  name          VARCHAR(100),
  capacity      INT,
  field_type    VARCHAR(50)       -- e.g., 'dog daycare', 'fitness', etc.
);

-- 3) BOOKINGS
CREATE TABLE bookings (
  id            SERIAL PRIMARY KEY,
  field_id      INT                NOT NULL
                               REFERENCES fields(id),
  start_time    TIMESTAMP          NOT NULL,
  end_time      TIMESTAMP          NOT NULL,
  service_type  VARCHAR(50),       -- e.g. 'dog daycare', 'yoga class'
  status        VARCHAR(20)        DEFAULT 'open',
  max_capacity  INT                -- If this booking is capped differently
);

-- 4) CLIENTS
CREATE TABLE clients (
  id            SERIAL PRIMARY KEY,
  user_id       VARCHAR(50),  -- Or UUID; links to auth system if needed
  name          VARCHAR(100),
  email         VARCHAR(100)
);

-- 5) PETS
CREATE TABLE pets (
  id            SERIAL PRIMARY KEY,
  client_id     INT                NOT NULL
                               REFERENCES clients(id),
  name          VARCHAR(50),
  breed         VARCHAR(100),
  size          VARCHAR(50)        -- e.g., 'Small', 'Medium', 'Large'
);

-- 6) BOOKING_CLIENTS (JOIN TABLE for Many-to-Many)
CREATE TABLE booking_clients (
  id            SERIAL PRIMARY KEY,
  booking_id    INT                NOT NULL
                               REFERENCES bookings(id),
  client_id     INT                NOT NULL
                               REFERENCES clients(id)
  -- Optional: pet_id INT REFERENCES pets(id) if you tie each booking to specific pets
);

-- 7) STAFF
CREATE TABLE staff (
  id            SERIAL PRIMARY KEY,
  user_id       VARCHAR(50),       -- Or UUID; links to auth system
  name          VARCHAR(100),
  role          VARCHAR(50),       -- e.g. 'admin', 'field_worker', 'driver'
  phone_number  VARCHAR(20),
  notes         TEXT
);