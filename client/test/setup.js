// Node has its own localStorage and Storage globals, so Vitest doesn't copy jsdom's over.
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: jsdom.window.localStorage });
Object.defineProperty(globalThis, 'Storage', { configurable: true, writable: true, value: jsdom.window.Storage });
