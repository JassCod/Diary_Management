'use strict';
// Reads a photo of a milk collection list/receipt with Claude and returns
// the rows as plain data. Needs ANTHROPIC_API_KEY on the server.

const MODEL = process.env.SCAN_MODEL || 'claude-opus-5-5';

const SCHEMA = {
  type: 'object',
  properties: {
    date_written: { type: 'string', description: 'Date written on the paper as YYYY-MM-DD, or empty string if none' },
    shift_written: { type: 'string', enum: ['morning', 'evening', 'unknown'] },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Farmer code/number exactly as written, or empty string' },
          name: { type: 'string', description: 'Farmer name as written (any script), or empty string' },
          milk_type: { type: 'string', enum: ['cow', 'buffalo', 'unknown'] },
          qty: { type: 'number', description: 'Litres' },
          fat: { type: 'number', description: 'Fat %, or 0 if not written' },
          snf: { type: 'number', description: 'SNF, or 0 if not written' },
          amount: { type: 'number', description: 'Rupee amount if written on the line, else 0' },
          unclear: { type: 'boolean', description: 'True if any value on this line was hard to read' },
        },
        required: ['code', 'name', 'milk_type', 'qty', 'fat', 'snf', 'amount', 'unclear'],
        additionalProperties: false,
      },
    },
  },
  required: ['date_written', 'shift_written', 'rows'],
  additionalProperties: false,
};

const SYSTEM = `You read photos of milk collection sheets and receipts from a village dairy in Punjab, India.
The paper may be handwritten or printed, in English, Punjabi (Gurmukhi) or Hindi, and may use Gurmukhi or Devanagari digits - convert all numbers to normal digits.
Each line is milk one farmer brought: usually a farmer code or name, litres, fat %, sometimes SNF, rate or amount.
Cow milk may be marked C / ਗਾਂ / गाय; buffalo milk B / M / ਮੱਝ / भैंस. Buffalo milk usually has fat above 5.5 and cow milk below 5.5 - use that only when the type is not written, and mark the row unclear.
Return one row per farmer line, in the order on the paper. Skip headings, totals and crossed-out lines.
Never invent a line or a number. If a value is unreadable, give your best reading and set unclear to true.
Use the farmer list below to recognise codes and names, but always copy what is written.`;

let client;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic();
  }
  return client;
}

const enabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

async function readMilkSheet({ imageBase64, mediaType, farmers }) {
  const list = farmers.map((f) => `${f.code || '-'} | ${f.name}${f.village ? ' | ' + f.village : ''}`).join('\n') || '(no farmers saved yet)';
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    system: `${SYSTEM}\n\nFarmers of this dairy (code | name | village):\n${list}`,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: 'Read every milk entry line on this paper.' },
      ],
    }],
  });

  if (response.stop_reason === 'refusal') throw new Error('The photo could not be read. Please try another photo.');
  if (response.stop_reason === 'max_tokens') throw new Error('The list is too long for one photo. Please photograph half the page at a time.');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The photo could not be read. Please try another photo.');
  }
}

module.exports = { readMilkSheet, enabled, MODEL };
