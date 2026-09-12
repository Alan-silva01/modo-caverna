const fs = require('fs');
let html = fs.readFileSync('prova/simulado_pmma_2026_completo.html', 'utf8');

const page1Idx = html.indexOf('<!-- PÁGINA 1: ITENS 1 A 20 -->');
const gabaritoIdx = html.indexOf('<!-- PÁGINA 6: GABARITO OFICIAL DEFINITIVO CEBRASPE COM IMAGEM DIRETA -->');

let examBody = html.substring(page1Idx, gabaritoIdx);

// Convert bubbles
examBody = examBody.replace(/<div class="item-block">([\s\S]*?)<span class="item-num">(\d+)<\/span>([\s\S]*?)<div class="bubbles-container">[\s\S]*?<\/div>\s*<\/div>/g, (match, p1, num, p2) => {
  return `<div class="item-block" id="item-block-${num}">` +
    p1 + `<span class="item-num">${num}</span>` + p2 +
    `<div class="bubbles-container" data-item="${num}">` +
      `<button type="button" class="bubble bubble-c" data-item="${num}" data-val="C">C</button>` +
      `<button type="button" class="bubble bubble-e" data-item="${num}" data-val="E">E</button>` +
    `</div>` +
  `</div>`;
});

const gabaritoPage = html.substring(gabaritoIdx, html.lastIndexOf('</div>') + 6);

const out = `export const simuladoPmmaHtml = ${JSON.stringify(examBody)};\nexport const simuladoPmmaGabaritoHtml = ${JSON.stringify(gabaritoPage)};\n`;
fs.writeFileSync('src/data/simuladoPmmaBody.ts', out);
console.log('Saved src/data/simuladoPmmaBody.ts successfully! Exam body length:', examBody.length);
