const fs = require('fs');
const html = fs.readFileSync('prova/simulado_pmma_2026_completo.html', 'utf8');

const page1Idx = html.indexOf('<!-- PÁGINA 1: ITENS 1 A 20 -->');
const page6Idx = html.indexOf('<!-- PÁGINA 6: GABARITO OFICIAL DEFINITIVO CEBRASPE COM IMAGEM DIRETA -->');

let examBody = html.substring(page1Idx, page6Idx);

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

const gabaritoPage = html.substring(page6Idx, html.lastIndexOf('</div>') + 6);

console.log('ExamBody length:', examBody.length);
console.log('ExamBody contains gabaritos-vermelho-title?', examBody.includes('gabaritos-vermelho-title'));
console.log('GabaritoPage contains gabaritos-vermelho-title?', gabaritoPage.includes('gabaritos-vermelho-title'));

const out = `export const simuladoPmmaHtml = ${JSON.stringify(examBody)};\nexport const simuladoPmmaGabaritoHtml = ${JSON.stringify(gabaritoPage)};\n`;
fs.writeFileSync('src/data/simuladoPmmaBody.ts', out);
console.log('Wrote src/data/simuladoPmmaBody.ts successfully!');
