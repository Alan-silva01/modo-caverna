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

    const { tema, texto, linhasCount } = await req.json();

    if (!tema || !texto) {
      return new Response(JSON.stringify({ error: "Tema e texto são obrigatórios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check client-side rule: less than 15 lines -> zero without calling OpenAI API
    if (typeof linhasCount === 'number' && linhasCount < 15) {
      const responsePayload = {
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
        sugestoesDeMelhoria: ["Desenvolva a estrutura completa de introdução, 2 parágrafos de desenvolvimento e conclusão com pelo menos 15 linhas."]
      };

      return new Response(JSON.stringify(responsePayload), {
        status: 200,
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

    const systemPrompt = `Você é um corretor sênior de redação do vestibular UEMA (Edital 214/2026-GR/UEMA).
Avalie o texto do candidato estritamente segundo estes 5 critérios, cada um valendo de 0,0 a 2,0 pontos:

1. Atendimento ao tema proposto (relações intertextuais, autonomia na escrita, amplo conhecimento de mundo/formal) [0.0 a 2.0]
2. Coesão entre as partes do texto (uso adequado de elementos coesivos inter e intraparágrafos, ausência de ambiguidade) [0.0 a 2.0]
3. Coerência dos argumentos (presença obrigatória de título, estrutura introdução/desenvolvimento/conclusão, progressão de ideias, clareza) [0.0 a 2.0]
4. Atendimento à tipologia dissertativo-argumentativa (tese clara, argumentos consistentes, poder persuasivo) [0.0 a 2.0]
5. Domínio do padrão culto escrito da língua (léxico apurado, morfologia, sintaxe, pontuação, ortografia, ausência de oralidade) [0.0 a 2.0]

Verifique também se o texto se enquadra em alguma situação de NOTA ZERO:
fuga total ao tema, fuga à tipologia dissertativo-argumentativa, texto sem tese/argumentação clara, texto não articulado ou palavras soltas.

Responda ESTRITAMENTE em JSON válido, sem nenhum texto fora do JSON, neste formato exato:
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

    const userMessage = `TEMA PROPOSTO: "${tema}"\n\nTEXTO DA REDAÇÃO DO CANDIDATO:\n\n${texto}`;

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
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

    // Backend arithmetic post-processing to ensure precision
    const c1 = Number(resultJson.criterio1) || 0;
    const c2 = Number(resultJson.criterio2) || 0;
    const c3 = Number(resultJson.criterio3) || 0;
    const c4 = Number(resultJson.criterio4) || 0;
    const c5 = Number(resultJson.criterio5) || 0;

    const notaBruta10 = resultJson.zerou ? 0 : Number((c1 + c2 + c3 + c4 + c5).toFixed(2));
    const notaFinal100 = resultJson.zerou ? 0 : Number((notaBruta10 * 10).toFixed(2));
    const eliminado = resultJson.zerou || notaBruta10 < 2.0;

    const payload = {
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

    return new Response(JSON.stringify(payload), {
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
