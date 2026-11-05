// Yjs collaboration server with LevelDB persistence and document deletion.

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import path from 'node:path';

const require = createRequire(import.meta.url);

process.env.HOST ??= '0.0.0.0';
process.env.PORT ??= '1234';
process.env.YPERSISTENCE ??= './yjs-data';

const host = process.env.HOST;
const port = Number(process.env.PORT);
const persistencePath = process.env.YPERSISTENCE;

// y-websocket creates its own persistence instance when YPERSISTENCE is set.
// Disable that implicit instance: this server owns one explicit LevelDB handle.
delete process.env.YPERSISTENCE;

const Y = require('yjs');
const { LeveldbPersistence } = require('y-leveldb');

// Resolve internal y-websocket utilities relative to the installed package.
const yWebsocketEntry = require.resolve('y-websocket');
const yWebsocketRoot = path.resolve(path.dirname(yWebsocketEntry), '..');
const yWebsocketUtils = require(path.join(yWebsocketRoot, 'bin', 'utils.js'));
const yWebsocketRequire = createRequire(path.join(yWebsocketRoot, 'bin', 'server.js'));
const WebSocket = yWebsocketRequire('ws');

const { setPersistence, setupWSConnection, docs } = yWebsocketUtils;
const db = new LeveldbPersistence(persistencePath);

const DELETED_COLLECTION = '__collab_editor_system__';
const deletedDocuments = new Set();
const persistenceQueues = new WeakMap();
const documentMutationQueues = new Map();

function textLength(doc) {
  let length = 0;

  const walk = (node) => {
    if (node instanceof Y.XmlText) {
      length += node.length;
    } else if (node instanceof Y.XmlElement || node instanceof Y.XmlFragment) {
      node.toArray().forEach(walk);
    }
  };

  walk(doc.getXmlFragment('default'));
  return length;
}

function enqueuePersistence(doc, operation) {
  const previous = persistenceQueues.get(doc) ?? Promise.resolve();
  const next = previous
    .catch((error) => {
      console.error('Previous document persistence operation failed:', error);
    })
    .then(operation);

  persistenceQueues.set(doc, next);

  next.catch((error) => {
    console.error('Document persistence failed:', error);
  });
}

async function isDocumentDeleted(docName) {
  if (deletedDocuments.has(docName)) return true;
  return (await db.getMeta(DELETED_COLLECTION, docName)) === true;
}

setPersistence({
  provider: db,

  bindState: async (docName, doc) => {
    if (await isDocumentDeleted(docName)) return;

    const persistedDoc = await db.getYDoc(docName);
    if (await isDocumentDeleted(docName)) {
      persistedDoc.destroy();
      return;
    }

    Y.applyUpdate(doc, Y.encodeStateAsUpdate(persistedDoc));
    persistedDoc.destroy();

    // Empty new documents are not stored. Once a document has content, all
    // subsequent changes are persisted, including deletions of that content.
    let hasPersistedContent = textLength(doc) > 0;

    doc.on('update', (update) => {
      if (deletedDocuments.has(docName)) return;

      const hasText = textLength(doc) > 0;
      if (!hasPersistedContent && !hasText) return;

      if (hasPersistedContent && !hasText) {
        hasPersistedContent = false;
        enqueuePersistence(doc, () => db.clearDocument(docName));
        return;
      }

      if (!hasPersistedContent && hasText) {
        hasPersistedContent = true;
        const snapshot = Y.encodeStateAsUpdate(doc);
        enqueuePersistence(doc, () => db.storeUpdate(docName, snapshot));
        return;
      }

      enqueuePersistence(doc, () => db.storeUpdate(docName, update));
    });
  },

  writeState: async (docName, doc) => {
    if (deletedDocuments.has(docName)) return;
    const pendingWrites = persistenceQueues.get(doc);
    if (pendingWrites) await pendingWrites;
  },
});

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function parseDocumentId(encodedId) {
  let docId;
  try {
    docId = decodeURIComponent(encodedId);
  } catch {
    return null;
  }

  return /^[a-zA-Z0-9_-]{1,128}$/.test(docId) && docId !== DELETED_COLLECTION
    ? docId
    : null;
}

function closeConnection(connection) {
  return new Promise((resolve) => {
    if (connection.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }

    connection.once('close', resolve);
    try {
      connection.close(4404, 'Document deleted');
      connection.terminate();
    } catch {
      resolve();
    }
  });
}

async function withDocumentMutationLock(docId, operation) {
  const previous = documentMutationQueues.get(docId) ?? Promise.resolve();
  let release;

  const current = new Promise((resolve) => {
    release = resolve;
  });

  documentMutationQueues.set(docId, current);

  await previous;

  try {
    return await operation();
  } finally {
    release();

    if (documentMutationQueues.get(docId) === current) {
      documentMutationQueues.delete(docId);
    }
  }
}

async function closeActiveDocument(docId) {
  const activeDoc = docs.get(docId);
  if (!activeDoc) return;

  const connections = [...activeDoc.conns.keys()];
  await Promise.all(connections.map(closeConnection));

  const pendingWrites = persistenceQueues.get(activeDoc);
  if (pendingWrites) await pendingWrites;

  if (docs.get(docId) === activeDoc) {
    docs.delete(docId);
    activeDoc.destroy();
  }
}

async function deleteDocument(docId) {
  return withDocumentMutationLock(docId, async () => {
    // Set both tombstones before closing connections.
    deletedDocuments.add(docId);
    await db.setMeta(DELETED_COLLECTION, docId, true);

    await closeActiveDocument(docId);
    await db.clearDocument(docId);
  });
}

async function recreateDocument(docId) {
  return withDocumentMutationLock(docId, async () => {
    if (!(await isDocumentDeleted(docId))) return false;

    // Keep the deleted marker until the old room and persisted state
    // are fully cleared.
    deletedDocuments.add(docId);

    await closeActiveDocument(docId);
    await db.clearDocument(docId);

    await db.setMeta(DELETED_COLLECTION, docId, false);
    deletedDocuments.delete(docId);

    return true;
  });
}

async function handleHttpRequest(request, response) {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost');

  if (request.method === 'GET' && requestUrl.pathname === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('ok\n');
    return;
  }

  const match = requestUrl.pathname.match(/^\/api\/documents\/([^/]+)$/);

  if (!match) {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  const docId = parseDocumentId(match[1]);

  if (!docId) {
    sendJson(response, 400, { error: 'Invalid document id' });
    return;
  }

  if (request.method === 'GET') {
    sendJson(response, 200, {
      deleted: await isDocumentDeleted(docId),
    });
    return;
  }

  if (request.method === 'DELETE') {
    await deleteDocument(docId);

    response.writeHead(204, { 'cache-control': 'no-store' });
    response.end();
    return;
  }

  if (request.method === 'POST') {
    const recreated = await recreateDocument(docId);

    if (!recreated) {
      sendJson(response, 409, { error: 'Document is not deleted' });
      return;
    }

    sendJson(response, 201, {
      recreated: true,
      id: docId,
    });

    return;
  }

  response.setHeader('allow', 'GET, DELETE, POST');
  sendJson(response, 405, { error: 'Method not allowed' });
}

const server = createServer((request, response) => {
  handleHttpRequest(request, response).catch((error) => {
    console.error('HTTP request failed:', error);

    if (!response.headersSent) {
      sendJson(response, 500, { error: 'Internal server error' });
    } else {
      response.destroy(error);
    }
  });
});

const websocketServer = new WebSocket.Server({ noServer: true });

websocketServer.on('connection', async (connection, request) => {
  try {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;

    const roomPath = pathname.startsWith('/ws/')
      ? pathname.slice('/ws/'.length)
      : pathname.replace(/^\//, '');

    const docId = parseDocumentId(roomPath);

    if (!docId || await isDocumentDeleted(docId)) {
      connection.close(4404, 'Document not found');
      return;
    }

    // Re-check the in-memory marker after asynchronous lookup.
    if (deletedDocuments.has(docId)) {
      connection.close(4404, 'Document deleted');
      return;
    }

    setupWSConnection(connection, request);
  } catch (error) {
    console.error('WebSocket connection setup failed:', error);

    if (connection.readyState !== WebSocket.CLOSED) {
      connection.close(1011, 'Internal server error');
    }
  }
});

server.on('upgrade', (request, socket, head) => {
  let pathname;

  try {
    pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  } catch {
    socket.destroy();
    return;
  }

  if (pathname.startsWith('/api/') || pathname === '/' || pathname.length < 2) {
    socket.destroy();
    return;
  }

  websocketServer.handleUpgrade(request, socket, head, (connection) => {
    websocketServer.emit('connection', connection, request);
  });
});

server.listen(port, host, () => {
  console.log(`Collab Editor server running on http://${host}:${port}`);
  console.log(`Persisting documents to "${persistencePath}"`);
});