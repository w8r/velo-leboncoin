const fs = require('fs');
const path = require('path');

const items = JSON.parse(fs.readFileSync('items.json'));
fs.writeFileSync(path.join(process.cwd(), 'output.html'), `
<html>
  <head>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
  <div class="ads">
  ${ items.map((item, i) => {
    if (!item.main_image) return '';
    return `
    <div class="item">
      <a href="${item.url}" target="_blank">
        <img src="${item.main_image.thumbnail}" />
      </a>
    </div>${ i % 100 === 0 ? '<hr>' : ''}
    `;
  }).join('') }
  </div>
  </body>
</html>
    `);
console.log('done');
