import {
  yXmlFragmentToProsemirrorJSON,
  prosemirrorJSONToYXmlFragment,
} from "y-prosemirror";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

const schema = getSchema([StarterKit]);

const MAX_PARA = 3000; // максимум символов в одном абзаце / блоке кода
const MAX_CONTAINER = 9000; // максимум символов в одной цитате или списке
const MAX_SECTION = 40000; // максимум символов в одной секции

const newId = () => crypto.randomUUID().slice(0, 8);

function textLen(node) {
  if (node.text) return node.text.length;
  return (node.content ?? []).reduce((a, n) => a + textLen(n), 0);
}

// Режет огромный абзац на несколько обычных (по предложениям и переносам строк)
function splitParagraph(p, max = MAX_PARA) {
  if (p.type !== "paragraph" || textLen(p) <= max) return [p];

  const out = [];
  let cur = [];
  let len = 0;

  const flush = () => {
    if (cur.length) out.push({ ...p, content: cur });
    cur = [];
    len = 0;
  };

  for (const n of p.content ?? []) {
    if (n.type === "hardBreak") {
      if (len >= 1000) flush();
      else cur.push(n);
      continue;
    }

    if (n.type !== "text") {
      cur.push(n);
      continue;
    }

    const sentences =
      n.text.match(/[^.!?…]+[.!?…]+["»”)]*\s*|[^.!?…]+$/g) ?? [n.text];

    for (const s of sentences) {
      for (let i = 0; i < s.length; i += max) {
        const part = s.slice(i, i + max);
        if (len + part.length > max && len > 0) flush();
        cur.push({ ...n, text: part });
        len += part.length;
      }
    }
  }

  flush();
  return out;
}

// Режет огромный блок кода по строкам
function splitCodeBlock(b, max = MAX_PARA) {
  const text = (b.content ?? []).map((n) => n.text ?? "").join("");
  if (text.length <= max) return [b];

  const out = [];
  let cur = "";
  const push = () => {
    if (cur) out.push({ ...b, content: [{ type: "text", text: cur }] });
    cur = "";
  };

  for (const line of text.split("\n")) {
    for (let i = 0; i < Math.max(line.length, 1); i += max) {
      const part = line.slice(i, i + max);
      if (cur.length + part.length + 1 > max && cur) push();
      cur += (cur ? "\n" : "") + part;
    }
  }
  push();
  return out;
}

// Режет любой крупный блок: абзац, код, цитату, список
function splitBlock(b) {
  if (textLen(b) <= MAX_PARA) return [b];

  switch (b.type) {
    case "paragraph":
      return splitParagraph(b);

    case "codeBlock":
      return splitCodeBlock(b);

    case "blockquote":
    case "bulletList":
    case "orderedList": {
      const kids = (b.content ?? []).flatMap(splitBlock);
      const out = [];
      let cur = [];
      let size = 0;
      for (const k of kids) {
        const l = textLen(k);
        if (size + l > MAX_CONTAINER && cur.length) {
          out.push({ ...b, content: cur });
          cur = [];
          size = 0;
        }
        cur.push(k);
        size += l;
      }
      if (cur.length) out.push({ ...b, content: cur });
      return out;
    }

    case "listItem":
      return [{ ...b, content: (b.content ?? []).flatMap(splitBlock) }];

    default:
      return [b];
  }
}

// Группирует блоки в секции по объёму текста
export function chunkBlocks(blocks, maxSection = MAX_SECTION) {
  const groups = [];
  let cur = [];
  let size = 0;

  for (const b of blocks.flatMap(splitBlock)) {
    const l = textLen(b);
    if (size + l > maxSection && cur.length) {
      groups.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(b);
    size += l;
  }

  if (cur.length) groups.push(cur);
  return groups;
}

export function getFullDocJSON(yDoc) {
  const ids = [...new Set(yDoc.getArray("sections").toArray())];
  const content = ids.flatMap(
    (id) =>
      yXmlFragmentToProsemirrorJSON(yDoc.getXmlFragment(id)).content ?? [],
  );
  return { type: "doc", content };
}

// Дописывает содержимое в конец документа новыми секциями
export function appendToSections(yDoc, json) {
  const blocks = json.content ?? [];
  if (blocks.length === 0) return false;

  const yArr = yDoc.getArray("sections");

  yDoc.transact(() => {
    // Старый документ: список секций пуст, но текст лежит в "default"
    if (yArr.length === 0 && yDoc.getXmlFragment("default").length > 0) {
      yArr.push(["default"]);
    }

    chunkBlocks(blocks).forEach((group) => {
      const id = yArr.length === 0 ? "default" : newId();

      prosemirrorJSONToYXmlFragment(
        schema,
        { type: "doc", content: group },
        yDoc.getXmlFragment(id),
      );
      yArr.push([id]);
    });
  });

  return true;
}

// Пересобирает ВЕСЬ документ: режет слишком большие блоки и секции.
// Запускать вручную, когда данные уже загружены и в документе больше никого нет.
export function resplitAll(yDoc) {
  const yArr = yDoc.getArray("sections");
  const ids = [...new Set(yArr.toArray())];
  if (!ids.includes("default") && yDoc.getXmlFragment("default").length > 0) {
    ids.unshift("default");
  }

  const content = ids.flatMap(
    (id) =>
      yXmlFragmentToProsemirrorJSON(yDoc.getXmlFragment(id)).content ?? [],
  );
  const groups = chunkBlocks(content);
  if (groups.length === 0) return 0;

  yDoc.transact(() => {
    ids.forEach((id) => {
      const f = yDoc.getXmlFragment(id);
      f.delete(0, f.length);
    });
    yArr.delete(0, yArr.length);

    groups.forEach((g, i) => {
      const id = i === 0 ? "default" : newId();
      prosemirrorJSONToYXmlFragment(
        schema,
        { type: "doc", content: g },
        yDoc.getXmlFragment(id),
      );
      yArr.push([id]);
    });
  });

  return groups.length;
}

// Алиас для старого имени
export const splitDefaultSection = resplitAll;