// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tema, texto, linhasCount, concursoId = 'uema' } = await req.json();

    if (!tema || !texto) {
      return new Response(JSON.stringify({ error: "Tema e texto são obrigatórios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY não configurada no Supabase" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tl = Math.max(1, linhasCount || 15);

    // ── MODO CEBRASPE: PCMA e POCMA ──
    if (concursoId === 'pcma' || concursoId === 'pocma') {
      const orgaoNome = concursoId === 'pcma' ? 'Polícia Civil do Maranhão (PCMA)' : 'Perícia Oficial do Maranhão (POCMA)';

      const systemPromptCebraspe = `Você é uma banca examinadora sênior do Cebraspe responsável pela correção da prova discursiva do concurso da ${orgaoNome}.
A prova consiste em uma redação de até 30 linhas valendo no máximo 20,00 pontos.

Sua tarefa é avaliar dois aspectos cruciais conforme o item 9.7 do edital oficial:

1. Nota de Conteúdo (NC) [0,00 a 20,00 pontos]:
   Apresentação visual, legibilidade/estrutura textual e desenvolvimento técnico dos conceitos do tema proposto.

2. Número de Erros (NE) [Inteiro >= 0]:
   Contagem minuciosa de falhas gramaticais (ortografia, acentuação, crase, concordância, regência, propriedade vocabular).

Regras de Zeragem Cebraspe:
- Marque "zerou": true se houver fuga total ao tema ou ausência de texto/texto não articulado.

Responda ESTRITAMENTE em JSON válido, sem nenhum texto fora do JSON, neste formato exato:
{
  "notaConteudoNC": 18.5,
  "errosGramaticaisNE": 2,
  "zerou": false,
  "motivoZero": null,
  "errosDetalhados": [
    { "trecho": "nao", "erro": "Falta de acentuação gráfica", "correcao": "não" }
  ],
  "pontosFortes": ["...", "..."],
  "pontosFracos": ["...", "..."],
  "sugestoesDeMelhoria": ["...", "..."]
}`;

      const userMessageCebraspe = `CONCURSO: ${orgaoNome} (Banca Cebraspe - Vale 20,00 pts)
TEMA PROPOSTO: "${tema}"
NÚMERO DE LINHAS ESCRITAS (TL): ${tl}

TEXTO DA REDAÇÃO DO CANDIDATO:
${texto}`;

      const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPromptCebraspe },
            { role: "user", content: userMessageCebraspe }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      });

      if (!openAiResponse.ok) {
        const errText = await openAiResponse.text();
        return new Response(JSON.stringify({ error: `Erro na API OpenAI: ${errText}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const openAiData = await openAiResponse.json();
      let contentStr = openAiData.choices[0].message.content.trim();

      if (contentStr.startsWith("```json")) contentStr = contentStr.substring(7);
      if (contentStr.startsWith("```")) contentStr = contentStr.substring(3);
      if (contentStr.endsWith("```")) contentStr = contentStr.substring(0, contentStr.length - 3);
      contentStr = contentStr.trim();

      const resultJson = JSON.parse(contentStr);

      const nc = Number(resultJson.notaConteudoNC) || 0;
      const ne = Number(resultJson.errosGramaticaisNE) || 0;

      // Official Cebraspe Formula: NPD = NC - (4 * NE) / TL
      const penalidade = Number(((4 * ne) / tl).toFixed(2));
      let npd = resultJson.zerou ? 0 : Number((nc - penalidade).toFixed(2));
      if (npd < 0) npd = 0;

      const aprovado = !resultJson.zerou && npd >= 10.00;
      const eliminado = !aprovado;

      const payloadCebraspe = {
        concursoId,
        banca: 'Cebraspe',
        notaConteudoNC: nc,
        errosGramaticaisNE: ne,
        linhasTL: tl,
        penalidadeErros: penalidade,
        notaFinalNPD: npd,
        notaFinal100: Number((npd * 5).toFixed(2)), // Convert to scale of 100 for comparison
        aprovado,
        eliminado,
        zerou: Boolean(resultJson.zerou),
        motivoZero: resultJson.motivoZero || (npd < 0 ? "Nota final discursiva menor que 0,00." : null),
        errosDetalhados: Array.isArray(resultJson.errosDetalhados) ? resultJson.errosDetalhados : [],
        pontosFortes: Array.isArray(resultJson.pontosFortes) ? resultJson.pontosFortes : [],
        pontosFracos: Array.isArray(resultJson.pontosFracos) ? resultJson.pontosFracos : [],
        sugestoesDeMelhoria: Array.isArray(resultJson.sugestoesDeMelhoria) ? resultJson.sugestoesDeMelhoria : []
      };

      return new Response(JSON.stringify(payloadCebraspe), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MODO UEMA (Edital 214/2026-GR/UEMA) ──
    if (typeof linhasCount === 'number' && linhasCount < 15) {
      const responsePayload = {
        concursoId: 'uema',
        banca: 'UEMA',
        criterio1: 0.0,
        criterio2: 0.0,
        criterio3: 0.0,
        criterio4: 0.0,
        criterio5: 0.0,
        notaBruta10: 0.0,
        notaFinal100: 0.0,
        zerou: true,
        motivoZero: "O texto possui menos de 15 linhas (regra de eliminação direta do Edital UEMA).",
        eliminado: true,
        pontosFortes: [],
        pontosFracos: ["Texto muito curto (menos de 15 linhas)."],
        sugestoesDeMelhoria: ["Desenvolva a estrutura completa em pelo menos 15 linhas."]
      };

      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPromptUema = `Você é um corretor sênior de redação do vestibular UEMA (Edital 214/2026-GR/UEMA).
Avalie o texto do candidato estritamente segundo estes 5 critérios, cada um valendo de 0,0 a 2,0 pontos:

1. Atendimento ao tema proposto [0.0 a 2.0]
2. Coesão entre as partes do texto [0.0 a 2.0]
3. Coerência dos argumentos & Estrutura [0.0 a 2.0]
4. Atendimento à tipologia dissertativo-argumentativa [0.0 a 2.0]
5. Domínio do padrão culto escrito da língua [0.0 a 2.0]

Responda ESTRITAMENTE em JSON válido, sem nenhum texto fora do JSON:
{
  "criterio1": 0.0,
  "criterio2": 0.0,
  "criterio3": 0.0,
  "criterio4": 0.0,
  "criterio5": 0.0,
  "zerou": false,
  "motivoZero": null,
  "pontosFortes": ["...", "..."],
  "pontosFracos": ["...", "..."],
  "sugestoesDeMelhoria": ["...", "..."]
}`;

    const userMessageUema = `TEMA PROPOSTO: "${tema}"\n\nTEXTO DA REDAÇÃO DO CANDIDATO:\n\n${texto}`;

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPromptUema },
          { role: "user", content: userMessageUema }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!openAiResponse.ok) {
      const errText = await openAiResponse.text();
      return new Response(JSON.stringify({ error: `Erro na API OpenAI: ${errText}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openAiData = await openAiResponse.json();
    let contentStr = openAiData.choices[0].message.content.trim();

    if (contentStr.startsWith("```json")) contentStr = contentStr.substring(7);
    if (contentStr.startsWith("```")) contentStr = contentStr.substring(3);
    if (contentStr.endsWith("```")) contentStr = contentStr.substring(0, contentStr.length - 3);
    contentStr = contentStr.trim();

    const resultJson = JSON.parse(contentStr);

    const c1 = Number(resultJson.criterio1) || 0;
    const c2 = Number(resultJson.criterio2) || 0;
    const c3 = Number(resultJson.criterio3) || 0;
    const c4 = Number(resultJson.criterio4) || 0;
    const c5 = Number(resultJson.criterio5) || 0;

    const notaBruta10 = resultJson.zerou ? 0 : Number((c1 + c2 + c3 + c4 + c5).toFixed(2));
    const notaFinal100 = resultJson.zerou ? 0 : Number((notaBruta10 * 10).toFixed(2));
    const eliminado = resultJson.zerou || notaBruta10 < 2.0;

    const payloadUema = {
      concursoId: 'uema',
      banca: 'UEMA',
      criterio1: c1,
      criterio2: c2,
      criterio3: c3,
      criterio4: c4,
      criterio5: c5,
      notaBruta10,
      notaFinal100,
      zerou: Boolean(resultJson.zerou),
      motivoZero: resultJson.motivoZero || null,
      eliminado,
      pontosFortes: Array.isArray(resultJson.pontosFortes) ? resultJson.pontosFortes : [],
      pontosFracos: Array.isArray(resultJson.pontosFracos) ? resultJson.pontosFracos : [],
      sugestoesDeMelhoria: Array.isArray(resultJson.sugestoesDeMelhoria) ? resultJson.sugestoesDeMelhoria : []
    };

    return new Response(JSON.stringify(payloadUema), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
