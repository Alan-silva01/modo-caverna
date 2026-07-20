// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS
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

    // Decode JWT to get user_id
    const token = authHeader.replace("Bearer ", "");
    const tokenParts = token.split(".");
    if (tokenParts.length < 2) {
      return new Response(JSON.stringify({ error: "Token JWT inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const payloadBase64Url = tokenParts[1];
    const base64 = payloadBase64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
    const payloadJson = JSON.parse(atob(padded));
    const userId = payloadJson.sub;

    if (!userId) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { disciplina, tema, disciplina_id, tema_id, quantidade, tipo } = await req.json();

    if (!disciplina || !tema || !disciplina_id || !tema_id || !quantidade || !tipo) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
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

    // System prompt & User prompt
    const systemPrompt = `Você é um examinador de elite de concursos públicos, especialista em elaborar questões complexas no estilo da banca CESPE/Cebraspe.

Regras de Ouro:
1. Nível de Dificuldade: As questões devem ser de nível MÉDIO a DIFÍCIL, adequadas para concursos de alta concorrência (Carreiras Policiais e Administrativas de nível superior). Evite perguntas conceituais simples ou diretas. Prefira enunciados baseados em casos práticos, situações hipotéticas complexas ou trechos doutrinários/jurisprudenciais profundos que exijam interpretação de verdade.
2. Questões de Certo / Errado:
   - Apresente uma assertiva detalhada que o candidato deve julgar como CERTO ou ERRADO.
   - Use técnicas tradicionais do CESPE para construir itens incorretos (Errados): sutil inversão de regras gerais e exceções, omissão de requisitos essenciais em um processo, substituição de termos técnicos semelhantes mas com significados diferentes, ou generalizações indevidas utilizando palavras como "sempre", "exclusivamente", "em qualquer hipótese".
3. Questões de Múltipla Escolha:
   - Forneça um enunciado robusto (ex: caso prático) seguido de 5 alternativas (A, B, C, D, E).
   - Apenas UMA alternativa deve ser correta. As outras 4 alternativas devem ser distratores altamente plausíveis (pegadinhas realistas), baseadas em entendimentos minoritários, dispositivos legais revogados ou interpretações errôneas comuns.
   - DISTRIBUIÇÃO DO GABARITO: Você deve distribuir de forma equilibrada e randômica a alternativa correta entre as letras A, B, C, D e E ao gerar o lote de questões. Evite a todo custo concentrar os gabaritos em uma única letra (especialmente a alternativa A). Varie ativamente a alternativa correta nas questões geradas.
4. Rigor Técnico: Nunca invente leis, artigos inexistentes ou jurisprudência fictícia. Todo o conteúdo deve ser baseado estritamente na legislação, doutrina ou jurisprudência real e pacificada do tema.
5. Justificativa: Forneça uma explicação detalhada e pedagógica (2 a 4 frases) fundamentando o gabarito de forma clara e apontando o erro das alternativas incorretas nos itens de múltipla escolha.

Responda APENAS em JSON válido, sem nenhum caractere ou explicação fora dele, seguindo rigorosamente este schema:
{
  "questoes": [
    {
      "enunciado": "string",
      "tipo": "${tipo}",
      "alternativas": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."] ou null para certo_errado,
      "gabarito": "C" ou "E" para certo_errado, ou "A", "B", "C", "D", "E" para multipla_escolha,
      "justificativa": "string"
    }
  ]
}`;

    const userPrompt = `Disciplina: ${disciplina}
Tema: ${tema}
Quantidade de questões: ${quantidade}
Tipo de questão: ${tipo}

Gere as questões conforme as regras do system prompt.`;

    // Call OpenAI
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
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
    let content = openAiData.choices[0].message.content.trim();
    
    // Clean up potential markdown code block wrappers
    if (content.startsWith("```json")) {
      content = content.substring(7);
    } else if (content.startsWith("```")) {
      content = content.substring(3);
    }
    if (content.endsWith("```")) {
      content = content.substring(0, content.length - 3);
    }
    content = content.trim();

    const parsed = JSON.parse(content);

    if (!parsed.questoes || !Array.isArray(parsed.questoes)) {
      throw new Error("JSON retornado pela IA não possui o formato esperado.");
    }

    // Save questions to Database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const insertRows = parsed.questoes.map((q: any) => {
      let normalizedGabarito = String(q.gabarito).trim();
      if (tipo === "certo_errado") {
        const upper = normalizedGabarito.toUpperCase();
        if (upper.startsWith("C")) {
          normalizedGabarito = "C";
        } else if (upper.startsWith("E")) {
          normalizedGabarito = "E";
        }
      } else if (tipo === "multipla_escolha") {
        normalizedGabarito = normalizedGabarito.toUpperCase().replace(/[^A-E]/g, "").charAt(0) || "A";
      }

      return {
        user_id: userId,
        disciplina_id: disciplina_id,
        tema_id: tema_id,
        tipo: tipo,
        enunciado: q.enunciado,
        alternativas: q.alternativas,
        gabarito: normalizedGabarito,
        justificativa: q.justificativa,
        banca_estilo: "CESPE",
      };
    });

    const { data: insertedData, error: dbError } = await supabaseClient
      .from("questoes")
      .insert(insertRows)
      .select();

    if (dbError) {
      return new Response(JSON.stringify({ error: `Erro ao salvar no banco: ${dbError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ questoes: insertedData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
