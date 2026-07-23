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

    const { tema, concursoId = "uema", textoAtual = "", modelId = "google/gemini-2.0-flash-001" } = await req.json();

    if (!tema) {
      return new Response(JSON.stringify({ error: "Tema é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY") || Deno.env.get("OPENAI_API_KEY");
    
    // Choose endpoint and headers based on key
    const isOpenRouter = Boolean(Deno.env.get("OPENROUTER_API_KEY"));
    const apiUrl = isOpenRouter
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

    const targetModel = isOpenRouter ? (modelId || "google/gemini-2.0-flash-001") : "gpt-4o";

    const systemPrompt = `Você é um tutor e assistente especialista em redação de concursos públicos (bancas UEMA e Cebraspe).
O estudante está escrevendo uma redação sobre o tema: "${tema}".
Edital Alvo: ${concursoId.toUpperCase()}.

Sua tarefa é analisar o texto escrito até o momento e sugerir continuações gramaticais de elite, elegantes e coerentes.

REGRAS:
1. Retorne ESTRITAMENTE um JSON válido.
2. Não use clichês vazios (ex: "é notório que", "nos dias atuais", "em suma").
3. Forneça:
   - "sugestaoTab": 1 frase curta ou continuação direta (máximo 15 palavras) que completa naturalmente o raciocínio atual.
   - "opcoes": Um array com 3 sugestões estratégicas:
     * Opção 1 (tipo: "Conectivo de Transição"): Um conectivo ou elemento coesivo formal para iniciar ou transitar no período.
     * Opção 2 (tipo: "Repertório Sociocultural"): Uma citação filosófica, jurídica, histórica ou dado relevante diretamente aplicável ao tema.
     * Opção 3 (tipo: "Desdobramento Argumentativo"): Uma frase persuasiva que aprofunda a tese ou causa do problema.

Formato JSON esperado:
{
  "sugestaoTab": "...",
  "opcoes": [
    { "tipo": "Conectivo de Transição", "texto": "..." },
    { "tipo": "Repertório Sociocultural", "texto": "..." },
    { "tipo": "Desdobramento Argumentativo", "texto": "..." }
  ]
}`;

    const userMessage = textoAtual.trim()
      ? `TEXTO ATUAL DO ESTUDANTE:\n"${textoAtual}"`
      : `O estudante acabou de iniciar a folha de rascunho para o tema "${tema}". Sugira como começar a introdução.`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openrouterApiKey}`,
    };

    if (isOpenRouter) {
      headers["HTTP-Referer"] = "https://intelflux.app";
      headers["X-Title"] = "Intelflux Concursos";
    }

    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: targetModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      return new Response(JSON.stringify({ error: `Erro na API do Provedor AI (${aiResponse.status}): ${errText}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let contentStr = aiData.choices[0].message.content.trim();

    if (contentStr.startsWith("```json")) contentStr = contentStr.substring(7);
    if (contentStr.startsWith("```")) contentStr = contentStr.substring(3);
    if (contentStr.endsWith("```")) contentStr = contentStr.substring(0, contentStr.length - 3);
    contentStr = contentStr.trim();

    const resultJson = JSON.parse(contentStr);

    return new Response(JSON.stringify(resultJson), {
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
