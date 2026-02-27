-- Inventory database schema
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster searches
CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory(name);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory(quantity);

-- Trigger to automatically update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_inventory_timestamp 
    AFTER UPDATE ON inventory
BEGIN
    UPDATE inventory SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Transaction log table for audit
CREATE TABLE IF NOT EXISTS transaction_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action VARCHAR(50) NOT NULL,
    item_id INTEGER,
    item_name VARCHAR(255),
    quantity_change INTEGER,
    previous_quantity INTEGER,
    new_quantity INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES inventory(id)
);

-- Index for transaction logs
CREATE INDEX IF NOT EXISTS idx_transaction_timestamp ON transaction_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_transaction_item ON transaction_log(item_id);