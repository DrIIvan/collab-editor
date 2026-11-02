import { createRequire } from "module";

const require = createRequire(import.meta.url);

process.env.HOST ??= "0.0.0.0";
process.env.PORT ??= "1234";
const DB_DIR = process.env.YPERSISTENCE ?? "./yjs-data";
delete process.env.YPERSISTENCE; // иначе utils.js откроет ту же БД второй раз

const { setPersistence } = require("y-websocket/bin/utils.js");
const { LeveldbPersistence } = require("y-leveldb");
const Y = require("yjs");

const ldb = new LeveldbPersistence(DB_DIR);

function textLength(doc) {
  let len = 0;
  const walk = (node) => {
    if (node instanceof Y.XmlText) {
      len += node.length;
    } else if (node instanceof Y.XmlElement || node instanceof Y.XmlFragment) {
      node.toArray().forEach(walk);
    }
  };
  walk(doc.getXmlFragment("default"));
  return len;
}

setPersistence({
  provider: ldb,
  bindState: async (docName, ydoc) => {
    await ldb.flushDocument(docName);
    const persistedDoc = await ldb.getYDoc(docName);
    // пишем в базу только если в документе уже есть текст
    let started = textLength(persistedDoc) > 0;

    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedDoc));

    ydoc.on("update", (update) => {
      if (!started) {
        if (textLength(ydoc) === 0) return;
        started = true;
        // первый раз: сохраняем всё состояние целиком
        ldb.storeUpdate(docName, Y.encodeStateAsUpdate(ydoc));
        return;
      }
      ldb.storeUpdate(docName, update);
    });
  },
  writeState: async () => {},
});

await import("y-websocket/bin/server.js");
