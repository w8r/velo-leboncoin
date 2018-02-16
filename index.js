const lbc  = require('./client');
const fs   = require('fs');
const path = require('path');
const argv = require('yargs').argv

const req = {
    category: 'velos',
    type: 'offres',
    region_or_department: 'ile_de_france',
    sellers: 'particuliers',
    query: '',
    sort: 'date',
    titles_only: false,
    urgent_only: false
};

const start = parseInt(argv.start) || 1;
const end   = parseInt(argv.end) || 5;

console.log(`requsting pages ${start} - ${end}`);

lbc.search(req, start, end) // browse pages 1 to 10
  .then((items) => {
    fs.writeFileSync(path.join(process.cwd(), 'items.json'), JSON.stringify(items));
    console.log(`Done, written ${items.length} items`);
  }, (error) => {
    console.error(error);
  });

