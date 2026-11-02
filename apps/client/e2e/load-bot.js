import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Приоритет: CLI аргумент -> переменная окружения -> дефолт
const SERVER_URL = process.argv[2] || process.env.WS_URL || 'ws://localhost:1234';
const DOC_ID = process.argv[3] || 'load-test-' + Date.now();
const BOTS = Number(process.argv[4] || 5);

if (!/^wss?:\/\//.test(SERVER_URL)) {
    console.error(`Некорректный URL: "${SERVER_URL}"`);
    console.error('Использование: node load-bot.js [ws://host:port] [docId] [bots]');
    process.exit(2);
}

console.log(`Цель: ${SERVER_URL}, документ: ${DOC_ID}, ботов: ${BOTS}`);

const promises = [];
for (let i = 0; i < BOTS; i += 1) {
    const p = new Promise((resolve) => {
        const doc = new Y.Doc();
        const provider = new WebsocketProvider(SERVER_URL, DOC_ID, doc);
        const root = doc.get('content', Y.XmlFragment);
        const name = `Bot-${i}`;
        let done = false;

        const finish = (ok) => {
            if (done) return;
            done = true;
            console.log(`[${name}] ${ok ? 'synced' : 'ТАЙМАУТ'}`);
            provider.destroy();
            doc.destroy();
            resolve(ok);
        };

        const timer = setTimeout(() => finish(false), 10000);

        provider.awareness.setLocalStateField('user', { name, color: '#ff0000' });

        provider.on('sync', (isSynced) => {
            if (!isSynced) return;
            const paragraph = new Y.XmlElement('p');
            paragraph.insert(0, [new Y.XmlText(`Привет от ${name}`)]);
            root.push([paragraph]);
            setTimeout(() => {
                clearTimeout(timer);
                finish(true);
            }, 500);
        });
    });
    promises.push(p);
}

const results = await Promise.all(promises);
const failed = results.filter((ok) => !ok).length;

if (failed > 0) {
    console.error(`Готово с ошибками: ${failed} из ${BOTS} ботов не синхронизировались`);
    process.exit(1);
}

console.log(`Все ${BOTS} ботов отработали. Откройте /d/${DOC_ID} и проверьте текст.`);
process.exit(0);