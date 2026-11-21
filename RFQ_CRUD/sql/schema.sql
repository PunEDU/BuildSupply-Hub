CREATE TABLE IF NOT EXISTS unit (
    unit_id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    unit_code VARCHAR(64) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS jobsite (
    jobsite_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    site_name VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Local fixtures for the buyer scope. The shared app can supply its own access table.
CREATE TABLE IF NOT EXISTS buyer_jobsite (
    buyer_id INT UNSIGNED NOT NULL,
    jobsite_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (buyer_id, jobsite_id),
    FOREIGN KEY (jobsite_id) REFERENCES jobsite (jobsite_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rfq (
    rfq_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    rfq_number VARCHAR(24) NOT NULL UNIQUE,
    jobsite_id INT UNSIGNED NULL,
    created_by_user_id INT UNSIGNED NOT NULL,
    delivery_address_text VARCHAR(255) NULL,
    requested_delivery_start DATETIME NULL,
    requested_delivery_end DATETIME NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    lock_version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (jobsite_id) REFERENCES jobsite (jobsite_id),
    INDEX rfq_buyer (created_by_user_id, rfq_id),
    CHECK (requested_delivery_start <= requested_delivery_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rfq_item (
    rfq_item_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    rfq_id INT UNSIGNED NOT NULL,
    line_no INT UNSIGNED NOT NULL,
    material_name VARCHAR(120) NOT NULL,
    specification_text VARCHAR(500) NULL,
    requested_quantity DECIMAL(14,4) NULL,
    unit_id SMALLINT UNSIGNED NULL,
    lock_version INT UNSIGNED NOT NULL DEFAULT 1,
    UNIQUE (rfq_id, line_no),
    FOREIGN KEY (rfq_id) REFERENCES rfq (rfq_id) ON DELETE CASCADE,
    FOREIGN KEY (unit_id) REFERENCES unit (unit_id),
    CHECK (requested_quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO unit (unit_code) VALUES ('Bag'), ('kg'), ('m'), ('m²'), ('m³'), ('Piece');
INSERT IGNORE INTO jobsite (site_name) VALUES ('Riverside Renovation'), ('North Yard Extension');
INSERT IGNORE INTO buyer_jobsite (buyer_id, jobsite_id)
    SELECT 1, jobsite_id FROM jobsite WHERE site_name IN ('Riverside Renovation', 'North Yard Extension');
