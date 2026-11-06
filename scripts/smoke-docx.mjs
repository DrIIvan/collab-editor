import assert from 'node:assert/strict';
import { createDocxBlob } from '../apps/client/src/lib/docx.js';

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  return crc >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const documentJson = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Тестовый документ', marks: [{ type: 'bold' }] }] },
    { type: 'paragraph', content: [
      { type: 'text', text: 'Текст со ' },
      { type: 'text', text: 'встроенным кодом', marks: [{ type: 'code' }] },
      { type: 'text', text: ' и ' },
      { type: 'text', text: 'ссылкой', marks: [{ type: 'italic' }, { type: 'link', attrs: { href: 'https://example.com' } }] },
    ] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Пункт списка' }] }] }] },
    { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Нумерованный пункт' }] }] }] },
    { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Цитата' }] }] },
    { type: 'codeBlock', content: [{ type: 'text', text: 'const answer = 42;' }] },
    { type: 'horizontalRule' },
  ],
};

const blob = createDocxBlob(documentJson, 'Smoke test');
const bytes = Buffer.from(await blob.arrayBuffer());
assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
assert.equal(bytes.readUInt32LE(0), 0x04034b50, 'DOCX must start with a ZIP local-file header');

const files = new Map();
let offset = 0;
while (bytes.readUInt32LE(offset) === 0x04034b50) {
  const method = bytes.readUInt16LE(offset + 8);
  const expectedCrc = bytes.readUInt32LE(offset + 14);
  const compressedSize = bytes.readUInt32LE(offset + 18);
  const fileNameLength = bytes.readUInt16LE(offset + 26);
  const extraLength = bytes.readUInt16LE(offset + 28);
  assert.equal(method, 0, 'The generated DOCX currently uses ZIP store mode');
  const nameStart = offset + 30;
  const name = bytes.subarray(nameStart, nameStart + fileNameLength).toString('utf8');
  const dataStart = nameStart + fileNameLength + extraLength;
  const data = bytes.subarray(dataStart, dataStart + compressedSize);
  assert.equal(crc32(data), expectedCrc, `CRC mismatch for ${name}`);
  files.set(name, data.toString('utf8'));
  offset = dataStart + compressedSize;
}

assert.equal(bytes.readUInt32LE(offset), 0x02014b50, 'DOCX must include a central directory');
for (const required of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/_rels/document.xml.rels']) {
  assert.ok(files.has(required), `Missing DOCX part: ${required}`);
}

const documentXml = files.get('word/document.xml');
assert.match(documentXml, /Тестовый документ/);
assert.match(documentXml, /w:val="Heading1"/);
assert.match(documentXml, /w:hyperlink/);
assert.match(documentXml, /w:numPr/);
assert.match(documentXml, /Цитата/);
assert.match(documentXml, /w:pStyle w:val=\"Quote\"/, 'Quotes must retain a semantic Word paragraph style');
assert.match(documentXml, /w:rStyle w:val=\"Code\"/, 'Inline code must retain a semantic Word character style');
assert.match(documentXml, /w:ascii=\"Consolas\"/, 'Inline code must retain its monospace font');
assert.match(documentXml, /const answer = 42/);
assert.match(documentXml, /w:pBdr><w:bottom/, 'Horizontal rules must be exported as bottom paragraph borders');
assert.match(files.get('word/styles.xml'), /w:style w:type=\"character\" w:styleId=\"Code\"/);
assert.match(files.get('word/_rels/document.xml.rels'), /https:\/\/example\.com/);

console.log('DOCX export smoke test passed.');
