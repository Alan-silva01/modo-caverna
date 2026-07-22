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

    const { tema } = await req.json();

    if (!tema) {
      return new Response(JSON.stringify({ error: "Tema é obrigatório." }), {
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

    const prompt = `Escreva uma redação dissertativo-argumentativa nota máxima (nota 100) sobre o tema: "${tema}".

Siga a estrutura obrigatória do vestibular UEMA:
1. Título criativo e instigante no início.
2. Introdução com tese clara e antecipação de dois argumentos.
3. Dois parágrafos de desenvolvimento densos, com repertório sociocultural legítimo e verificável (dados reais, referências históricas, filosóficas ou jurídicas relevantes).
4. Conclusão com proposta de intervenção detalhada (agente + ação + meio + finalidade + detalhamento).

REGRAS DE ESTILO E VOZ HUMANA:
- Escreva com voz humana, elegante e natural.
- Varie a extensão dos períodos.
- NUNCA use clichês de redação genérica (ex: "é notório que", "nos dias atuais", "diante do exposto", "em suma").
- Utilize vocabulário apurado e próprio de um candidato de alta performance muito bem preparado.

Retorne em formato JSON estrito:
{
  "titulo": "string",
  "textoCompleto": "string"
}`;

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.6,
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
