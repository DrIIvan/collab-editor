const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");

function xmlEscape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getWordAttr(element, name) {
  return element?.getAttributeNS(WORD_NS, name) ?? element?.getAttribute(`w:${name}`);
}

function directChildren(element, localName) {
  if (!element) return [];
  return Array.from(element.childNodes).filter(
    (node) => node.nodeType === 1 && (!localName || node.localName === localName),
  );
}

function directChild(element, localName) {
  return directChildren(element, localName)[0] ?? null;
}

function descendants(element, localName) {
  return Array.from(element?.getElementsByTagNameNS(WORD_NS, localName) ?? []);
}

function enabledWordFlag(element) {
  if (!element) return false;
  const value = getWordAttr(element, "val");
  return value == null || !["0", "false", "off", "none"].includes(value.toLowerCase());
}

function parseXml(xml, partName) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const error = document.querySelector("parsererror");
  if (error) throw new Error(`Не удалось прочитать ${partName}: некорректный XML.`);
  return document;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Этот браузер не поддерживает распаковку DOCX. Обновите браузер до актуальной версии.");
  }
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    throw new Error("Не удалось распаковать DOCX. Проверьте, что файл не повреждён и не защищён паролем.");
  }
}

async function readZipEntries(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length > 25 * 1024 * 1024) throw new Error("Размер DOCX не должен превышать 25 МБ.");
  const view = new DataView(buffer);
  const minEocd = Math.max(0, bytes.length - 0xffff - 22);
  let eocd = -1;

  for (let offset = bytes.length - 22; offset >= minEocd; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("Файл не является корректным DOCX/ZIP-документом.");

  const entryCount = view.getUint16(eocd + 10, true);
  let centralOffset = view.getUint32(eocd + 16, true);
  const entries = new Map();
  const requiredParts = new Set(["word/document.xml", "word/_rels/document.xml.rels", "word/numbering.xml"]);
  let totalUncompressedSize = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(centralOffset, true) !== 0x02014b50) {
      throw new Error("Повреждён каталог DOCX-файла.");
    }
    const method = view.getUint16(centralOffset + 10, true);
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const uncompressedSize = view.getUint32(centralOffset + 24, true);
    const fileNameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localOffset = view.getUint32(centralOffset + 42, true);
    const fileName = decoder.decode(bytes.subarray(centralOffset + 46, centralOffset + 46 + fileNameLength));

    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error(`Повреждена запись ${fileName} внутри DOCX.`);
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    if (dataStart + compressedSize > bytes.length) throw new Error(`Данные ${fileName} выходят за пределы DOCX-файла.`);

    if (requiredParts.has(fileName)) {
      totalUncompressedSize += uncompressedSize;
      if (uncompressedSize === 0xffffffff || totalUncompressedSize > 100 * 1024 * 1024) {
        throw new Error("Содержимое DOCX слишком велико для безопасного импорта.");
      }
      const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
      let content;
      if (method === 0) content = compressed.slice();
      else if (method === 8) content = await inflateRaw(compressed);
      else throw new Error(`DOCX использует неподдерживаемый метод сжатия (${method}).`);
      if (content.length !== uncompressedSize) throw new Error(`Не удалось проверить размер части ${fileName}.`);
      entries.set(fileName, content);
    }
    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function isSafeHyperlink(href) {
  return typeof href === "string" && /^(https?:\/\/|mailto:|tel:)/i.test(href);
}

function readRelationshipTargets(xml) {
  if (!xml || typeof DOMParser === "undefined") return new Map();
  const document = new DOMParser().parseFromString(xml, "application/xml");
  return new Map(
    Array.from(document.getElementsByTagNameNS(PACKAGE_REL_NS, "Relationship"))
      .filter((item) => item.getAttribute("TargetMode") === "External")
      .map((item) => [item.getAttribute("Id"), item.getAttribute("Target")])
      .filter(([, target]) => isSafeHyperlink(target)),
  );
}

function parseRun(run, inheritedMarks = []) {
  const properties = directChild(run, "rPr");
  const marks = [...inheritedMarks];
  const addMark = (type, attrs) => {
    if (!marks.some((mark) => mark.type === type)) marks.push({ type, ...(attrs ? { attrs } : {}) });
  };

  if (enabledWordFlag(directChild(properties, "b"))) addMark("bold");
  if (enabledWordFlag(directChild(properties, "i"))) addMark("italic");
  if (enabledWordFlag(directChild(properties, "u"))) addMark("underline");
  if (enabledWordFlag(directChild(properties, "strike")) || enabledWordFlag(directChild(properties, "dstrike"))) addMark("strike");
  const runStyle = getWordAttr(directChild(properties, "rStyle"), "val")?.toLowerCase() ?? "";
  const fonts = directChild(properties, "rFonts");
  const fontNames = ["ascii", "hAnsi", "eastAsia", "cs"]
    .map((name) => getWordAttr(fonts, name)?.toLowerCase() ?? "")
    .join(" ");
  // DOCX produced by this editor uses the explicit Code character style and
  // Consolas. Other Word processors commonly use a named code/verbatim style
  // or one of the usual monospaced fonts for inline code.
  if (
    /code|verbatim/.test(runStyle) ||
    /consolas|courier|mono|cascadia|source code pro|lucida console/.test(fontNames)
  ) {
    addMark("code");
  }

  const content = [];
  for (const child of directChildren(run)) {
    if (child.localName === "t" || child.localName === "delText") {
      if (child.textContent) content.push({ type: "text", text: child.textContent, ...(marks.length ? { marks: [...marks] } : {}) });
    } else if (child.localName === "tab") {
      content.push({ type: "text", text: "\t", ...(marks.length ? { marks: [...marks] } : {}) });
    } else if (child.localName === "br" || child.localName === "cr") {
      content.push({ type: "hardBreak" });
    } else if (child.localName === "noBreakHyphen") {
      content.push({ type: "text", text: "‑", ...(marks.length ? { marks: [...marks] } : {}) });
    } else if (child.localName === "softHyphen") {
      content.push({ type: "text", text: "\u00ad", ...(marks.length ? { marks: [...marks] } : {}) });
    }
  }
  return content;
}

function parseParagraph(paragraph, relationships, numbering) {
  const pPr = directChild(paragraph, "pPr");
  const pStyle = getWordAttr(directChild(pPr, "pStyle"), "val")?.toLowerCase() ?? "";
  const numPr = directChild(pPr, "numPr");
  const numId = getWordAttr(directChild(numPr, "numId"), "val");
  const level = Number(getWordAttr(directChild(numPr, "ilvl"), "val") ?? 0);
  let list = null;
  if (numId && numbering.has(numId)) {
    list = { ...numbering.get(numId), numId, level: Number.isFinite(level) ? level : 0 };
  }

  const content = [];
  const appendInlineContainer = (container, inheritedMarks = []) => {
    for (const child of directChildren(container)) {
      if (child.localName === "r") {
        content.push(...parseRun(child, inheritedMarks));
      } else if (child.localName === "hyperlink") {
        const relId = child.getAttributeNS(REL_NS, "id") ?? child.getAttribute("r:id");
        const href = relationships.get(relId);
        const linkMarks = href ? [...inheritedMarks, { type: "link", attrs: { href } }] : inheritedMarks;
        appendInlineContainer(child, linkMarks);
      } else if (child.localName === "sdt") {
        appendInlineContainer(child, inheritedMarks);
      } else if (child.localName === "smartTag" || child.localName === "customXml") {
        appendInlineContainer(child, inheritedMarks);
      }
    }
  };
  appendInlineContainer(paragraph);

  const headingMatch = pStyle.match(/heading\s*([1-6])/);
  const borders = directChild(pPr, "pBdr");
  const hasBorder = (edge) => {
    const border = directChild(borders, edge);
    const value = getWordAttr(border, "val")?.toLowerCase();
    return Boolean(border) && !["nil", "none", "0"].includes(value);
  };
  const hasText = content.some((item) => item.type === "text" && item.text.length > 0) ||
    content.some((item) => item.type === "hardBreak");
  let node;
  // A horizontal rule exported by this editor is represented as an empty
  // paragraph with a bottom paragraph border. Check it before the generic
  // paragraph branch, otherwise it silently becomes an empty paragraph.
  if (!hasText && hasBorder("bottom") && !hasBorder("left") && !hasBorder("right")) {
    node = { type: "horizontalRule" };
  } else if (headingMatch) {
    node = { type: "heading", attrs: { level: Number(headingMatch[1]) }, content };
  } else if (/^title$/.test(pStyle)) {
    node = { type: "heading", attrs: { level: 1 }, content };
  } else if (/^subtitle$/.test(pStyle)) {
    node = { type: "paragraph", content: content.map((item) => item.type === "text"
      ? { ...item, marks: item.marks?.some((mark) => mark.type === "italic")
        ? item.marks
        : [...(item.marks ?? []), { type: "italic" }] }
      : item) };
  } else if (/quote|intensequote/.test(pStyle) || hasBorder("left")) {
    // The editor marks quotes using a left border. Recognize the actual
    // paragraph formatting as well as standard Word quote style names.
    node = { type: "blockquote", content: [{ type: "paragraph", content }] };
  } else if (/code|sourcecode|verbatim/.test(pStyle)) {
    const codeContent = content.flatMap((item) => {
      if (item.type === "text") return [{ type: "text", text: item.text }];
      if (item.type === "hardBreak") return [{ type: "text", text: "\n" }];
      return [];
    });
    node = { type: "codeBlock", content: codeContent };
  } else {
    node = { type: "paragraph", content };
  }

  return { node, list };
}

function readNumbering(numberingXml) {
  const byAbstractId = new Map();
  const byNumId = new Map();
  if (!numberingXml) return byNumId;
  const document = parseXml(numberingXml, "word/numbering.xml");

  for (const abstract of descendants(document, "abstractNum")) {
    const abstractId = getWordAttr(abstract, "abstractNumId");
    const level = directChild(abstract, "lvl");
    const format = getWordAttr(directChild(level, "numFmt"), "val");
    byAbstractId.set(abstractId, format === "bullet" ? "bulletList" : "orderedList");
  }
  for (const num of descendants(document, "num")) {
    const numId = getWordAttr(num, "numId");
    const abstractId = getWordAttr(directChild(num, "abstractNumId"), "val");
    byNumId.set(numId, { type: byAbstractId.get(abstractId) ?? "orderedList" });
  }
  return byNumId;
}

function buildDocumentBlocks(items) {
  const blocks = [];
  let activeList = null;

  const flushList = () => {
    if (activeList) blocks.push(activeList.node);
    activeList = null;
  };

  for (const item of items) {
    if (item.list) {
      const key = `${item.list.type}:${item.list.numId ?? ""}:${item.list.level}`;
      if (!activeList || activeList.key !== key) {
        flushList();
        activeList = { key, node: { type: item.list.type, content: [] } };
      }
      activeList.node.content.push({ type: "listItem", content: [item.node.type === "paragraph" ? item.node : { type: "paragraph", content: item.node.content ?? [] }] });
    } else {
      flushList();
      blocks.push(item.node);
    }
  }
  flushList();
  return blocks.length ? blocks : [{ type: "paragraph" }];
}

/** Convert a DOCX ArrayBuffer to a TipTap document JSON object. */
export async function importDocx(arrayBuffer) {
  if (typeof DOMParser === "undefined") throw new Error("Импорт DOCX доступен в браузере.");
  const entries = await readZipEntries(arrayBuffer);
  const documentBytes = entries.get("word/document.xml");
  if (!documentBytes) throw new Error("В DOCX отсутствует основной текстовый документ.");

  const documentXml = parseXml(decoder.decode(documentBytes), "word/document.xml");
  const relationships = readRelationshipTargets(entries.has("word/_rels/document.xml.rels")
    ? decoder.decode(entries.get("word/_rels/document.xml.rels")) : null);
  const numbering = readNumbering(entries.has("word/numbering.xml")
    ? decoder.decode(entries.get("word/numbering.xml")) : null);
  const body = descendants(documentXml, "body")[0];
  if (!body) throw new Error("В DOCX не найдено содержимое документа.");

  const parsed = [];
  for (const child of directChildren(body)) {
    if (child.localName === "p") {
      parsed.push(parseParagraph(child, relationships, numbering));
    } else if (child.localName === "tbl") {
      // The current editor has no table extension, so preserve table text as paragraphs.
      for (const paragraph of descendants(child, "p")) {
        parsed.push(parseParagraph(paragraph, relationships, numbering));
      }
    } else if (child.localName === "sdt") {
      for (const paragraph of descendants(child, "p")) {
        parsed.push(parseParagraph(paragraph, relationships, numbering));
      }
    }
  }

  return { type: "doc", content: buildDocumentBlocks(parsed) };
}

function renderTextNode(node, hyperlinkState) {
  if (node.type === "hardBreak") return "<w:r><w:br/></w:r>";
  if (node.type !== "text") return "";
  const marks = node.marks ?? [];
  const props = [];
  const isCode = marks.some((mark) => mark.type === "code");
  if (isCode) {
    // Keep the semantic marker and font at the beginning of w:rPr as required
    // by the WordprocessingML run-property sequence.
    props.push('<w:rStyle w:val="Code"/>');
    props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>');
  }
  if (marks.some((mark) => mark.type === "bold")) props.push("<w:b/>");
  if (marks.some((mark) => mark.type === "italic")) props.push("<w:i/>");
  if (marks.some((mark) => mark.type === "underline")) props.push('<w:u w:val="single"/>');
  if (marks.some((mark) => mark.type === "strike")) props.push("<w:strike/>");
  if (isCode) props.push('<w:shd w:fill="F2F2F2" w:val="clear"/>');

  const candidateHref = marks.find((mark) => mark.type === "link")?.attrs?.href;
  const href = isSafeHyperlink(candidateHref) ? candidateHref : null;
  const chunks = String(node.text ?? "").split(/(\n|\t)/);
  const textXml = chunks.map((chunk) => {
    if (chunk === "\n") return "<w:br/>";
    if (chunk === "\t") return "<w:tab/>";
    if (!chunk) return "";
    return `<w:t xml:space="preserve">${xmlEscape(chunk)}</w:t>`;
  }).join("");
  if (!textXml) return "";
  const run = `<w:r>${props.length ? `<w:rPr>${props.join("")}</w:rPr>` : ""}${textXml}</w:r>`;
  if (href && hyperlinkState) {
    let id = hyperlinkState.ids.get(href);
    if (!id) {
      id = `rId${hyperlinkState.nextId++}`;
      hyperlinkState.ids.set(href, id);
    }
    return `<w:hyperlink r:id="${id}" w:history="1">${run}</w:hyperlink>`;
  }
  return run;
}

function renderInline(content, hyperlinkState) {
  return (content ?? []).map((node) => renderTextNode(node, hyperlinkState)).join("");
}

function paragraphXml(content, hyperlinkState, options = {}) {
  const pPr = [];
  if (options.style) pPr.push(`<w:pStyle w:val="${options.style}"/>`);
  if (options.numId) {
    pPr.push(`<w:numPr><w:ilvl w:val="${options.level ?? 0}"/><w:numId w:val="${options.numId}"/></w:numPr>`);
  }
  if (options.quote) {
    pPr.push('<w:pStyle w:val="Quote"/>');
    pPr.push('<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="808080"/></w:pBdr>');
    pPr.push('<w:ind w:left="360"/>');
  }
  if (options.code) pPr.push('<w:shd w:fill="F2F2F2" w:val="clear"/>');
  const properties = pPr.length ? `<w:pPr>${pPr.join("")}</w:pPr>` : "";
  return `<w:p>${properties}${renderInline(content, hyperlinkState)}</w:p>`;
}

function renderBlocks(nodes, hyperlinkState, options = {}) {
  const result = [];
  for (const node of nodes ?? []) {
    switch (node.type) {
      case "paragraph":
        result.push(paragraphXml(node.content, hyperlinkState, options));
        break;
      case "heading":
        result.push(paragraphXml(node.content, hyperlinkState, { ...options, style: `Heading${node.attrs?.level ?? 1}` }));
        break;
      case "blockquote":
        result.push(...renderBlocks(node.content, hyperlinkState, { ...options, quote: true }));
        break;
      case "codeBlock":
        result.push(paragraphXml(node.content, hyperlinkState, { ...options, style: "CodeBlock", code: true }));
        break;
      case "bulletList":
      case "orderedList": {
        const numId = node.type === "bulletList" ? 1 : 2;
        for (const item of node.content ?? []) {
          for (const child of item.content ?? []) {
            if (child.type === "paragraph") {
              result.push(paragraphXml(child.content, hyperlinkState, {
                ...options,
                numId,
                level: Math.min(options.level ?? 0, 8),
              }));
            } else {
              result.push(...renderBlocks([child], hyperlinkState, { ...options, level: (options.level ?? 0) + 1 }));
            }
          }
        }
        break;
      }
      case "horizontalRule":
        result.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="808080"/></w:pBdr></w:pPr></w:p>');
        break;
      case "listItem":
        result.push(...renderBlocks(node.content, hyperlinkState, options));
        break;
      default:
        if (node.content) result.push(...renderBlocks(node.content, hyperlinkState, options));
    }
  }
  return result.join("");
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const write16 = (view, at, value) => view.setUint16(at, value, true);
  const write32 = (view, at, value) => view.setUint32(at, value >>> 0, true);

  for (const [name, text] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(text);
    const checksum = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const localView = new DataView(local.buffer);
    write32(localView, 0, 0x04034b50);
    write16(localView, 4, 20);
    write16(localView, 6, 0x0800);
    write16(localView, 8, 0);
    write16(localView, 10, 0);
    write16(localView, 12, 0);
    write32(localView, 14, checksum);
    write32(localView, 18, data.length);
    write32(localView, 22, data.length);
    write16(localView, 26, nameBytes.length);
    write16(localView, 28, 0);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    write32(centralView, 0, 0x02014b50);
    write16(centralView, 4, 20);
    write16(centralView, 6, 20);
    write16(centralView, 8, 0x0800);
    write16(centralView, 10, 0);
    write16(centralView, 12, 0);
    write16(centralView, 14, 0);
    write32(centralView, 16, checksum);
    write32(centralView, 20, data.length);
    write32(centralView, 24, data.length);
    write16(centralView, 28, nameBytes.length);
    write16(centralView, 30, 0);
    write16(centralView, 32, 0);
    write16(centralView, 34, 0);
    write16(centralView, 36, 0);
    write32(centralView, 38, 0);
    write32(centralView, 42, offset);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50);
  write16(endView, 4, 0);
  write16(endView, 6, 0);
  write16(endView, 8, centralParts.length);
  write16(endView, 10, centralParts.length);
  write32(endView, 12, centralSize);
  write32(endView, 16, offset);
  write16(endView, 20, 0);
  return new Blob([...localParts, ...centralParts, end], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/** Create a valid, uncompressed DOCX Blob from the editor's TipTap JSON. */
export function createDocxBlob(documentJson, documentTitle = "Документ") {
  const hyperlinkState = { ids: new Map(), nextId: 3 };
  const content = renderBlocks(documentJson?.content ?? [], hyperlinkState);
  const relationships = [
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>',
    ...Array.from(hyperlinkState.ids, ([href, id]) =>
      `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(href)}" TargetMode="External"/>`),
  ].join("");
  const now = new Date().toISOString();

  return createZip({
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PACKAGE_REL_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${WORD_NS}" xmlns:r="${REL_NS}"><w:body>${content}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`,
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PACKAGE_REL_NS}">${relationships}</Relationships>`,
    "word/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${WORD_NS}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${[1,2,3,4,5,6].map((level) => `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="${Math.max(22, 36 - level * 2)}"/></w:rPr></w:style>`).join("")}<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:i/></w:style><w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="Code Block"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/></w:rPr></w:style><w:style w:type="character" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="DefaultParagraphFont"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:fill="F2F2F2" w:val="clear"/></w:rPr></w:style></w:styles>`,
    "word/numbering.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="${WORD_NS}"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="multilevel"/>${Array.from({ length: 9 }, (_, level) => `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${["•", "◦", "▪"][level % 3]}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 + level * 360}" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr></w:lvl>`).join("")}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="multilevel"/>${Array.from({ length: 9 }, (_, level) => `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="${"%" + (level + 1) + "."}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 + level * 360}" w:hanging="360"/></w:pPr></w:lvl>`).join("")}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`,
    "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(documentTitle)}</dc:title><dc:creator>Collab Editor</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`,
  });
}

/** Trigger a browser download for a generated DOCX file. */
export function downloadDocx(documentJson, fileName) {
  const blob = createDocxBlob(documentJson, fileName.replace(/\.docx$/i, ""));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.toLowerCase().endsWith(".docx") ? fileName : `${fileName}.docx`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
