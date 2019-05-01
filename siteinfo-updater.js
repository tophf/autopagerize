/* eslint-env node */
'use strict';

const http = require('http');
const fs = require('fs');

const DATA_URL = 'http://wedata.net/databases/AutoPagerize/items_all.json';
const FILE = 'siteinfo.json';
const KNOWN_KEYS = [
  'url',
  'nextLink',
  'insertBefore',
  'pageElement',
];

console.log('Fetching ' + DATA_URL);
http.get(DATA_URL, r => {
  const data = [];
  let size = 0;
  r.on('data', str => {
    data.push(str);
    size += str.length;
    process.stdout.write('\r' + Math.round(size / 1024) + ' kiB');
  });
  r.on('end', () => {
    const json = sanitize(JSON.parse(data.join('')));
    fs.writeFileSync(FILE, JSON.stringify(json, null, '  '));
    console.log();
    console.log('Done');
  });
});

function sanitize(data) {
  return (Array.isArray(data) ? data : [])
    .map(x => x && x.data && x.data.url && pickKnownKeys(x.data, x.resource_url))
    .filter(Boolean)
    .sort((a, b) => a.id - b.id);
}

function pickKnownKeys(entry, resourceUrl) {
  for (const key of Object.keys(entry)) {
    if (!KNOWN_KEYS.includes(key)) {
      const newEntry = {};
      for (const k of KNOWN_KEYS) {
        const v = entry[k];
        if (v !== undefined)
          newEntry[k] = v;
      }
      entry = newEntry;
      break;
    }
  }
  entry.id = Number(resourceUrl.slice(resourceUrl.lastIndexOf('/') + 1));
  return entry;
}
