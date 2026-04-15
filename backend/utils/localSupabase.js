const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '..', '.local-data');
const storageDir = path.join(__dirname, '..', 'output');
const dbPath = path.join(dataDir, 'db.json');

const defaultDb = {
  restaurants: [],
  menu_items: [],
  campaigns: [],
  creatives: []
};

function ensureDirs() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(storageDir, { recursive: true });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadDb() {
  ensureDirs();
  if (!fs.existsSync(dbPath)) return clone(defaultDb);

  try {
    const parsed = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    return { ...clone(defaultDb), ...parsed };
  } catch (error) {
    console.warn('Local database was unreadable, starting from an empty store:', error.message);
    return clone(defaultDb);
  }
}

function saveDb(db) {
  ensureDirs();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function newId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeStoragePath(bucket, fileName) {
  const target = path.resolve(storageDir, bucket, fileName);
  const root = path.resolve(storageDir, bucket);
  if (!target.startsWith(root + path.sep) && target !== root) {
    throw new Error('Invalid storage path');
  }
  return target;
}

function publicUrlFor(bucket, fileName) {
  const baseUrl = process.env.PUBLIC_BASE_URL ||
    process.env.API_BASE_URL ||
    `http://localhost:${process.env.PORT || 3000}`;
  const publicPath = `${bucket}/${fileName}`
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return `${baseUrl.replace(/\/$/, '')}/generated/${publicPath}`;
}

class LocalStorageBucket {
  constructor(bucket) {
    this.bucket = bucket;
  }

  async upload(fileName, body) {
    try {
      const target = sanitizeStoragePath(this.bucket, fileName);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, Buffer.isBuffer(body) ? body : Buffer.from(body));
      return {
        data: {
          path: fileName,
          fullPath: `${this.bucket}/${fileName}`
        },
        error: null
      };
    } catch (error) {
      return { data: null, error };
    }
  }

  getPublicUrl(fileName) {
    return {
      data: {
        publicUrl: publicUrlFor(this.bucket, fileName)
      }
    };
  }
}

class LocalQueryBuilder {
  constructor(store, table) {
    this.store = store;
    this.table = table;
    this.operation = 'select';
    this.payload = null;
    this.columns = '*';
    this.filters = [];
    this.orders = [];
    this.singleResult = false;
  }

  select(columns = '*') {
    this.columns = columns;
    return this;
  }

  insert(payload) {
    this.operation = 'insert';
    this.payload = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  update(payload) {
    this.operation = 'update';
    this.payload = payload || {};
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(field, value) {
    this.filters.push({ type: 'eq', field, value });
    return this;
  }

  in(field, values) {
    this.filters.push({ type: 'in', field, values: values || [] });
    return this;
  }

  gt(field, value) {
    this.filters.push({ type: 'gt', field, value });
    return this;
  }

  order(field, options = {}) {
    this.orders.push({ field, ascending: options.ascending !== false });
    return this;
  }

  single() {
    this.singleResult = true;
    return this;
  }

  then(resolve, reject) {
    return Promise.resolve()
      .then(() => this.execute())
      .then(resolve, reject);
  }

  async execute() {
    try {
      if (!this.store.db[this.table]) {
        throw new Error(`Unknown local table: ${this.table}`);
      }

      if (this.operation === 'insert') return this.executeInsert();
      if (this.operation === 'update') return this.executeUpdate();
      if (this.operation === 'delete') return this.executeDelete();
      return this.executeSelect();
    } catch (error) {
      return { data: null, error };
    }
  }

  executeSelect() {
    const rows = this.applyOrdering(this.filteredRows());
    const data = this.singleResult ? (rows[0] || null) : rows;
    return { data: clone(data), error: null };
  }

  executeInsert() {
    const inserted = this.payload.map(row => this.withDefaults(row));
    this.store.db[this.table].push(...inserted);
    saveDb(this.store.db);

    const data = this.singleResult ? inserted[0] : inserted;
    return { data: clone(data), error: null };
  }

  executeUpdate() {
    const updated = [];
    this.store.db[this.table] = this.store.db[this.table].map(row => {
      if (!this.matches(row)) return row;
      const next = { ...row, ...this.payload };
      if (this.table === 'restaurants') next.updated_at = nowIso();
      updated.push(next);
      return next;
    });
    saveDb(this.store.db);

    const data = this.singleResult ? (updated[0] || null) : updated;
    return { data: clone(data), error: null };
  }

  executeDelete() {
    const deleted = [];
    this.store.db[this.table] = this.store.db[this.table].filter(row => {
      if (!this.matches(row)) return true;
      deleted.push(row);
      return false;
    });

    this.applyCascades(deleted);
    saveDb(this.store.db);

    const data = this.singleResult ? (deleted[0] || null) : deleted;
    return { data: clone(data), error: null };
  }

  withDefaults(row) {
    const base = {
      id: row.id || newId(),
      created_at: row.created_at || nowIso()
    };

    if (this.table === 'restaurants') {
      return {
        ...base,
        logo_url: null,
        brand_colors: [],
        theme: 'casual',
        brand_name: null,
        updated_at: row.updated_at || nowIso(),
        ...row
      };
    }

    if (this.table === 'menu_items') {
      return {
        ...base,
        category: 'Menu',
        price: 0,
        description: '',
        image_url: null,
        tags: [],
        is_bestseller: false,
        ...row
      };
    }

    if (this.table === 'campaigns') {
      return {
        ...base,
        status: 'processing',
        selected_dishes: [],
        total_creatives: 0,
        zip_url: null,
        ...row
      };
    }

    if (this.table === 'creatives') {
      return {
        ...base,
        image_url: null,
        export_type: 'png',
        caption_headline: null,
        caption_body: null,
        cta_text: null,
        dimensions: null,
        ...row
      };
    }

    return { ...base, ...row };
  }

  filteredRows() {
    const rows = this.store.db[this.table]
      .filter(row => this.matches(row))
      .map(row => this.decorate(row));
    return rows;
  }

  matches(row) {
    return this.filters.every(filter => {
      const value = row[filter.field];
      if (filter.type === 'eq') return value === filter.value;
      if (filter.type === 'in') return filter.values.includes(value);
      if (filter.type === 'gt') return Number(value || 0) > Number(filter.value);
      return true;
    });
  }

  decorate(row) {
    const next = { ...row };
    if (this.table === 'creatives' && this.columns.includes('menu_items')) {
      const item = this.store.db.menu_items.find(menuItem => menuItem.id === row.menu_item_id);
      next.menu_items = item
        ? {
            name: item.name,
            price: item.price,
            description: item.description
          }
        : null;
    }
    return next;
  }

  applyOrdering(rows) {
    if (this.orders.length === 0) return rows;

    return rows.sort((a, b) => {
      for (const order of this.orders) {
        const result = this.compareValues(a[order.field], b[order.field]);
        if (result !== 0) return order.ascending ? result : -result;
      }
      return 0;
    });
  }

  compareValues(a, b) {
    if (a === b) return 0;
    if (a === null || a === undefined) return 1;
    if (b === null || b === undefined) return -1;
    if (typeof a === 'string' || typeof b === 'string') {
      return String(a).localeCompare(String(b));
    }
    return a > b ? 1 : -1;
  }

  applyCascades(deleted) {
    if (this.table === 'restaurants') {
      const restaurantIds = new Set(deleted.map(row => row.id));
      const campaignIds = new Set(
        this.store.db.campaigns
          .filter(campaign => restaurantIds.has(campaign.restaurant_id))
          .map(campaign => campaign.id)
      );
      this.store.db.menu_items = this.store.db.menu_items
        .filter(item => !restaurantIds.has(item.restaurant_id));
      this.store.db.campaigns = this.store.db.campaigns
        .filter(campaign => !restaurantIds.has(campaign.restaurant_id));
      this.store.db.creatives = this.store.db.creatives
        .filter(creative => !campaignIds.has(creative.campaign_id));
    }

    if (this.table === 'campaigns') {
      const campaignIds = new Set(deleted.map(row => row.id));
      this.store.db.creatives = this.store.db.creatives
        .filter(creative => !campaignIds.has(creative.campaign_id));
    }

    if (this.table === 'menu_items') {
      const itemIds = new Set(deleted.map(row => row.id));
      this.store.db.creatives = this.store.db.creatives.map(creative => (
        itemIds.has(creative.menu_item_id)
          ? { ...creative, menu_item_id: null }
          : creative
      ));
    }
  }
}

class LocalSupabase {
  constructor() {
    this.db = loadDb();
    this.storageDir = storageDir;
    this.isLocal = true;
    this.storage = {
      from: bucket => new LocalStorageBucket(bucket)
    };
  }

  from(table) {
    return new LocalQueryBuilder(this, table);
  }
}

module.exports = new LocalSupabase();
