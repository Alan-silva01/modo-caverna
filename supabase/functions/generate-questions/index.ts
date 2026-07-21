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
    const { disciplina, tema, disciplina_id, tema_id, quantidade, tipo, dificuldade = 'extremo' } = await req.json();

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

    const nivelInstrucao = dificuldade === 'medio'
      ? 'MÉDIO (Concursos de nível intermediário/técnico. Itens diretos com boa fundamentação).'
      : dificuldade === 'dificil'
      ? 'DIFÍCIL (Concursos de nível superior avançado. Casos práticos e interpretação jurídica/técnica profunda).'
      : 'EXTREMO / ALTO NÍVEL (Estilo Prova de Perito Criminal, Delegado e Oficial PM. Questões ultra-desafiadoras baseadas em situações hipotéticas complexas, jurisprudência recente de STF/STJ, exceções da regra e pegadinhas de doutrina de alto nível).';

    // System prompt & User prompt
    const systemPrompt = `Você é um examinador sênior de elite da banca CESPE / Cebraspe, famoso por elaborar provas de altíssimo nível de dificuldade para concursos de elite (Carreiras Policiais, Perícia, Magistratura e Fiscal).

NÍVEL EXIGIDO NESTA GERAÇÃO: ${nivelInstrucao}

Regras Obrigatórias de Formatação e Dificuldade:
1. Complexidade e Pegadinhas Cebraspe:
   - NUNCA crie perguntas conceituais simples ou diretas do tipo "O que é X?".
   - Crie enunciados densos e realistas baseados em CASOS PRÁTICOS (situações hipotéticas de 4 a 7 linhas), jurisprudência pacificada (STF/STJ, Súmulas Vinculantes) ou trechos doutrinários avançados.
   - Aplique as famosas "pegadinhas sutis" do Cebraspe para itens ERRADOS: substituição de termos técnicos semelhantes, inversão imperceptível de regra geral x exceção, omissão de requisito indispensável, ou generalizações indevidas com palavras como "exclusivamente", "sempre", "em qualquer hipótese".

2. Questões de Certo / Errado:
   - Apresente um caso/assertiva robusta que o candidato deve julgar como CERTO ou ERRADO.
   - O campo "gabarito" no JSON para Certo/Errado deve ser "C" (para Certo) ou "E" (para Errado).

3. Questões de Múltipla Escolha:
   - Enunciado robusto com caso prático seguido de 5 alternativas (A, B, C, D, E) verossímeis e desafiadoras.
   - OBRIGATÓRIO: Coloque SEMPRE a resposta correta no índice 0 ("A) ..."). As outras 4 (B a E) devem ser distratores muito bem elaborados que parecem corretos para quem não domina os detalhes. Defina "gabarito" no JSON sempre como "A".

4. Rigor Técnico e Legislação Real:
   - Baseie-se 100% na legislação oficial brasileira, doutrina respeitada e jurisprudência real. Jamais invente dados.

5. Justificativa Pedagógica de Elite:
   - Forneça uma justificativa detalhada (3 a 5 frases) fundamentando o motivo legal/doutrinário exato e citando o erro das alternativas falsas. Não mencione a letra da alternativa na justificativa (ex: explique a matéria diretamente).

Responda APENAS em JSON válido conforme este schema:
{
  "questoes": [
    {
      "enunciado": "string",
      "tipo": "${tipo}",
      "alternativas": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."] ou null para certo_errado,
      "gabarito": "C" ou "E" para certo_errado, ou "A" para multipla_escolha,
      "justificativa": "string"
    }
  ]
}`;

    const userPrompt = `Disciplina: ${disciplina}
Tema: ${tema}
Quantidade de questões: ${quantidade}
Tipo de questão: ${tipo}
Nível de dificuldade: ${dificuldade}

Gere as ${quantidade} questões no nível ${dificuldade} conforme o prompt.`;

    // Call OpenAI with GPT-4o
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
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
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
      let alts = q.alternativas;

      if (tipo === "certo_errado") {
        const upper = normalizedGabarito.toUpperCase();
        if (upper.startsWith("C") || upper === "CERTO" || upper === "TRUE") {
          normalizedGabarito = "C";
        } else if (upper.startsWith("E") || upper === "ERRADO" || upper === "FALSE") {
          normalizedGabarito = "E";
        } else {
          // Fallback robusto: deduz gabarito a partir da justificativa
          const justUpper = String(q.justificativa).toUpperCase();
          if (
            justUpper.includes("CORRETA") ||
            justUpper.includes("CERTA") ||
            justUpper.includes("CORRETO") ||
            justUpper.includes("CERTO") ||
            justUpper.includes("ESTÁ CORRETO") ||
            justUpper.includes("É CORRETO")
          ) {
            normalizedGabarito = "C";
          } else {
            normalizedGabarito = "E";
          }
        }
      } else if (tipo === "multipla_escolha" && Array.isArray(alts) && alts.length === 5) {
        // Limpa os prefixos (ex: "A) ", "a - ")
        const cleanAlts = alts.map((a: string) => a.replace(/^[A-E][)\-\s]*/i, "").trim());

        // A resposta correta gerada pela IA sempre estará no índice 0
        const indexedAlts = cleanAlts.map((text: string, idx: number) => ({
          text,
          isCorrect: idx === 0
        }));

        // Embaralha as alternativas no servidor
        const shuffled = [...indexedAlts].sort(() => Math.random() - 0.5);

        // Encontra a nova posição da alternativa correta
        const correctIdx = shuffled.findIndex((item: any) => item.isCorrect);
        normalizedGabarito = String.fromCharCode(65 + correctIdx); // A, B, C, D, E

        // Reconstitui com os prefixos corretos das novas posições
        alts = shuffled.map((item: any, idx: number) => {
          const letter = String.fromCharCode(65 + idx);
          return `${letter}) ${item.text}`;
        });
      } else if (tipo === "multipla_escolha") {
        normalizedGabarito = normalizedGabarito.toUpperCase().replace(/[^A-E]/g, "").charAt(0) || "A";
      }

      return {
        user_id: userId,
        disciplina_id: disciplina_id,
        tema_id: tema_id,
        tipo: tipo,
        enunciado: q.enunciado,
        alternativas: alts,
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
