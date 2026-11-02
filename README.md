# Collab Editor — Полное руководство

Совместный редактор документов в реальном времени на Yjs + TipTap + React.

## Архитектура

```
collab-editor/
├── apps/
│   ├── server/          # y-websocket сервер (Node.js)
│   └── client/          # React + Vite + TipTap
├── scripts/             # Smoke-тесты и утилиты
├── docker-compose.yml   # Контейнеризация
└── .github/workflows/   # CI/CD
```

**Технологии:**
- **Сервер:** Node.js 22, y-websocket, LevelDB (через y-leveldb)
- **Клиент:** React 18, Vite, TipTap, y-prosemirror
- **Протокол:** WebSocket (y-websocket protocol)
- **Персистентность:** LevelDB с ленивым сохранением пустых документов

---

## Требования

- Node.js 22+ (для глобального `WebSocket` API)
- npm 9+ (для workspaces)
- Docker Desktop (опционально, для контейнеризации)

---

## Быстрый старт (локально)

### 1. Установка зависимостей

```bash
git clone https://github.com/DrIIvan/collab-editor.git
cd collab-editor
npm install
```

### 2. Запуск

**Вариант A: одной командой**
```bash
npm run dev
```

**Вариант B: в двух терминалах**
```bash
# Терминал 1 — сервер
cd apps/server
npm run dev

# Терминал 2 — клиент
cd apps/client
npm run dev
```

### 3. Проверка

Откройте браузер:
- **Клиент:** http://localhost:5174
- **Тестовый документ:** http://localhost:5174/d/test-123

---

## Запуск через Docker

### 1. Создайте `.env` файл

```bash
cp .env.example .env
```

Содержимое:
```env
VITE_WS_URL=ws://localhost:1234
```

### 2. Запуск

```bash
# Собрать и запустить
docker compose up --build

# Или в фоне
docker compose up -d --build
```

### 3. Проверка

- **Клиент:** http://localhost:5174
- **Сервер:** ws://localhost:1234
