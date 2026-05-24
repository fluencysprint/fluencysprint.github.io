import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC = path.resolve(__dirname, '../../../public');
const ROOT = path.resolve(__dirname, '../../../');

function readManifest() {
  const raw = fs.readFileSync(path.join(PUBLIC, 'manifest.webmanifest'), 'utf-8');
  return JSON.parse(raw);
}

// ─── Test 1: manifest.webmanifest exists ──────────────────────────────────────

describe('test 1 — manifest.webmanifest exists', () => {
  it('file is present in public/', () => {
    expect(fs.existsSync(path.join(PUBLIC, 'manifest.webmanifest'))).toBe(true);
  });
});

// ─── Test 2: start_url is "/" ─────────────────────────────────────────────────

describe('test 2 — manifest start_url is "/"', () => {
  it('start_url equals "/"', () => {
    expect(readManifest().start_url).toBe('/');
  });
});

// ─── Test 3: scope is "/" ─────────────────────────────────────────────────────

describe('test 3 — manifest scope is "/"', () => {
  it('scope equals "/"', () => {
    expect(readManifest().scope).toBe('/');
  });
});

// ─── Test 4: display is "standalone" ─────────────────────────────────────────

describe('test 4 — manifest display is "standalone"', () => {
  it('display equals "standalone"', () => {
    expect(readManifest().display).toBe('standalone');
  });
});

// ─── Test 5: manifest has icons array ────────────────────────────────────────

describe('test 5 — manifest has icons', () => {
  it('icons array is non-empty', () => {
    const manifest = readManifest();
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  it('icon files exist in public/', () => {
    const manifest = readManifest();
    for (const icon of manifest.icons) {
      const filePath = path.join(PUBLIC, icon.src.replace(/^\//, ''));
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });
});

// ─── Test 6: index.html links the manifest ───────────────────────────────────

describe('test 6 — index.html links manifest', () => {
  it('index.html contains <link rel="manifest">', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('manifest.webmanifest');
  });
});

// ─── Test 7: service worker file exists ──────────────────────────────────────

describe('test 7 — service worker file exists', () => {
  it('public/sw.js is present', () => {
    expect(fs.existsSync(path.join(PUBLIC, 'sw.js'))).toBe(true);
  });

  it('sw.js has install and fetch event listeners', () => {
    const sw = fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf-8');
    expect(sw).toContain("addEventListener('install'");
    expect(sw).toContain("addEventListener('fetch'");
    expect(sw).toContain("addEventListener('activate'");
  });
});

// ─── Test 8: manifest required fields are present ────────────────────────────

describe('test 8 — manifest has required fields', () => {
  it('has name, short_name, description, theme_color, background_color', () => {
    const m = readManifest();
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.description).toBeTruthy();
    expect(m.theme_color).toBeTruthy();
    expect(m.background_color).toBeTruthy();
  });
});
