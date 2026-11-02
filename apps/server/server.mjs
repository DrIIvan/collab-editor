// Custom launcher with empty-document filtering.
// Documents without text content are never written to the database.

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Environment defaults
process.env.HOST ??= '0.0.0.0';
process.env.PORT ??= '1234';
process.env.YPERSISTENCE ??= './yjs-data';

// Import internal y-websocket utilities via CommonJS (ESM exports are restricted)
const { setPersistence } = require('y-websocket/bin/utils.js');
const { YLevel } = require('y-leveldb');
const Y = require('yjs');

// Initialize database
const db = new YLevel(process.env.YPERSISTENCE);

// Helper: calculate total text length in document
function textLength(doc) {
    let len = 0;
    const walk = (node) => {
        if (node instanceof Y.XmlText) {
            len += node.length;
        } else if (node instanceof Y.XmlElement || node instanceof Y.XmlFragment) {
            node.toArray().forEach(walk);
        }
    };
    walk(doc.getXmlFragment('default'));
    return len;
}

// Custom persistence: skip writes for empty documents
setPersistence({
    bindState: (docName, doc) => db.bindState(docName, doc),
    writeState: (docName, doc) => {
        if (textLength(doc) === 0) {
            // Skip writing empty documents to prevent database bloat
            return Promise.resolve();
        }
        return db.writeState(docName, doc);
    },
    provider: db,
});

// Now start the server with custom persistence
await import('y-websocket/bin/server.js');