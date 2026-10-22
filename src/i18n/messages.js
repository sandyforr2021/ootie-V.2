import { shopMessages } from './shop.js';
import { interfaceMessages } from './interface.js';
import { atelierMessages } from './atelier.js';
import { connectedMessages } from './connected.js';

// Reviewed, local dictionaries. Changing language never sends text to a paid API.
export function rowsToMessages(rows) {
  return Object.fromEntries(rows.trim().split('\n').filter(Boolean).map((row) => {
    const [zh, en, ja, es] = row.split('|');
    if (!zh || !en || !ja || !es) throw new Error(`Incomplete locale entry: ${zh}`);
    return [zh, { 'zh-TW': zh, en, ja, es }];
  }));
}
export const messages = { ...rowsToMessages(shopMessages), ...rowsToMessages(interfaceMessages), ...rowsToMessages(atelierMessages), ...rowsToMessages(connectedMessages) };
