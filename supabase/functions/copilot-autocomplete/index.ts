// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to extract JSON from raw AI text response
function extractJsonFromText(text: string) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.substring(7);
  if (cleaned.startsWith("```")) cleaned = cleaned.substring(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.substring(0, cleaned.length - 3);
  cleaned = cleaned.trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

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

    const {
      tema,
      concursoId = "uema",
      textoAtual = "",
      textoAntesCursor,
      textoDepoisCursor,
      modelId = "meta-llama/llama-3.3-70b-instruct:free"
    } = await req.json();

    if (!tema) {
      return new Response(JSON.stringify({ error: "Tema é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openrouterKey && !openaiKey) {
      return new Response(JSON.stringify({ error: "Nenhuma chave de API configurada no Supabase Secrets." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um assistente copilot de autocompletar texto (estilo GitHub Copilot / Antigravity) especializado em redações discursivas de concursos públicos (${concursoId.toUpperCase()}).
O estudante está escrevendo uma redação sobre o tema: "${tema}".

Instruções estritas:
1. "sugestaoTab": Deve ser uma continuação fluida, elegante e coesa de 5 a 15 palavras que se encaixe no PONTO EXATO do cursor do usuário. Não repita o texto existente.
2. "opcoes": 3 alternativas estruturadas ("Conectivo de Transição", "Repertório Sociocultural", "Desdobramento Argumentativo").

Retorne APENAS um JSON no seguinte formato estrito:
{
  "sugestaoTab": "...",
  "opcoes": [
    { "tipo": "Conectivo de Transição", "texto": "..." },
    { "tipo": "Repertório Sociocultural", "texto": "..." },
    { "tipo": "Desdobramento Argumentativo", "texto": "..." }
  ]
}`;

    const prefixText = textoAntesCursor !== undefined ? textoAntesCursor : textoAtual;
    const suffixText = textoDepoisCursor || "";

    const userMessage = prefixText.trim()
      ? `TEXTO DA REDAÇÃO ANTES DO CURSOR:\n"${prefixText}"\n${suffixText.trim() ? `\nTEXTO DA REDAÇÃO DEPOIS DO CURSOR:\n"${suffixText}"\n` : ""}\nO cursor do estudante está ${suffixText.trim() ? "entre o trecho anterior e o posterior" : "no final do texto"}. Sugira a continuação exata para o ponto do cursor.`
      : `O estudante vai começar a redação sobre "${tema}". Sugira a introdução.`;

    let successResult = null;

    // 1. Try OpenRouter if key is present
    if (openrouterKey) {
      const openRouterModelsToTry = [
        modelId,
        "meta-llama/llama-3.3-70b-instruct:free",
        "google/gemini-2.0-pro-exp-02-05:free",
        "deepseek/deepseek-r1:free"
      ];

      for (const currentModel of [...new Set(openRouterModelsToTry)]) {
        try {
          // Note: OpenRouter free models reject response_format: { type: 'json_object' }
          const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${openrouterKey}`,
              "HTTP-Referer": "https://intelflux.app",
              "X-Title": "Intelflux Concursos"
            },
            body: JSON.stringify({
              model: currentModel,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
              ],
              temperature: 0.5,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const textContent = data.choices[0]?.message?.content;
            if (textContent) {
              successResult = extractJsonFromText(textContent);
              break;
            }
          }
        } catch {
          // continue to next model candidate
        }
      }
    }

    // 2. Fallback to OpenAI gpt-4o-mini if OpenRouter didn't yield a result
    if (!successResult && openaiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          response_format: { type: "json_object" },
          temperature: 0.5,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const textContent = data.choices[0]?.message?.content;
        if (textContent) {
          successResult = extractJsonFromText(textContent);
        }
      }
    }

    if (!successResult) {
      return new Response(JSON.stringify({ error: "Não foi possível obter sugestões no momento. Tente novamente em instantes." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(successResult), {
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
