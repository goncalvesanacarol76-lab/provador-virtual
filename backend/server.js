import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fetch from 'node-fetch';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 5000;

// Configuração do ID de Versão do Replicate
// 💡 ESTE É O ID DE VERSÃO MAIS RECENTE E CORRETO PARA O MODELO omnious/vella-1.5 (Novembro/2025)
const REPLICATE_VERSION_ID = "15411671930948c2d20b81fa41e1af6075f6181b2e38477bdd3526d50affe4a9";

// --- MIDDLEWARES ---
app.use(cors({ origin: '*' }));
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // Limite de 10MB por arquivo
  }
});

// --- ROTA PRINCIPAL DE UPLOAD E TRY-ON ---
app.post("/api/upload", upload.fields([
  { name: "model_image", maxCount: 1 },
  { name: "garment_image", maxCount: 1 }
]), async (req, res) => {

  console.log("🟢 Requisição recebida em /api/upload");

  try {
    // 1. Verificação de Token
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error("ERRO: REPLICATE_API_TOKEN não configurada no ambiente.");
      return res.status(500).json({ error: "REPLICATE_API_TOKEN não configurada. Verifique o Render." });
    }

    // 2. Verificação de Arquivos
    if (!req.files || !req.files.model_image || !req.files.garment_image) {
      console.error("ERRO: Faltam ficheiros na requisição.");
      return res.status(400).json({ error: "É necessário enviar 'model_image' e 'garment_image'." });
    }

    const modelFile = req.files.model_image[0];
    const garmentFile = req.files.garment_image[0];

    // 3. Conversão para Base64 (O formato que o Replicate espera)
    const base64Model = `data:${modelFile.mimetype};base64,${modelFile.buffer.toString('base64')}`;
    const base64Garment = `data:${garmentFile.mimetype};base64,${garmentFile.buffer.toString('base64')}`;

    console.log("Imagens convertidas. A contactar o Replicate para criar a predição...");

    // 4. CHAMA A API DO REPLICATE PARA CRIAR A PREDIÇÃO
    const createResp = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        version: REPLICATE_VERSION_ID, // Usando o ID de versão CORRETO
        input: {
          model_image: base64Model,
          top_image: base64Garment // Nomes de input corretos para vella-1.5
        }
      })
    });

    const createJson = await createResp.json();

    if (!createResp.ok) {
      console.error("❌ ERRO do Replicate (ao criar):", createJson);
      // O erro 'The specified version does not exist' virá daqui se o ID estiver errado
      return res.status(createResp.status || 500).json({ 
        error: createJson.detail || "Erro criando a prediction no Replicate.",
        details: createJson // Adicionado para melhor debug
      });
    }

    let finalOutput = null;
    const getUrl = createJson.urls?.get;
    if (!getUrl) {
      return res.status(500).json({ error: "Resposta inesperada do Replicate (sem urls.get)." });
    }

    // 5. POLLING (Aguardar o resultado da IA)
    console.log("Predição criada. A aguardar resultado...");
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000)); // Espera 2 segundos (Total de 60s)
      const pollResp = await fetch(getUrl, {
        headers: { "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}` }
      });
      const pollJson = await pollResp.json();
      console.log(`...status: ${pollJson.status} (Tentativa ${i+1}/30)`);

      if (pollJson.status === "succeeded") {
        // A API retorna um array de URLs, pegamos a primeira
        finalOutput = Array.isArray(pollJson.output) ? pollJson.output[0] : pollJson.output;
        break;
      }
      if (pollJson.status === "failed" || pollJson.status === "canceled") {
        console.error("❌ ERRO: Geração falhou no Replicate:", pollJson);
        return res.status(500).json({ error: "Geração falhou no Replicate. Tente outra imagem de pessoa.", details: pollJson.error || "Detalhes desconhecidos." });
      }
    }

    if (!finalOutput) {
      console.error("❌ ERRO: Timeout (60s) aguardando o modelo.");
      return res.status(504).json({ error: "Timeout aguardando o resultado do modelo. Tente novamente." });
    }

    // 6. SUCESSO!
    console.log("✅ Sucesso! A enviar URL para o frontend:", finalOutput);
    return res.json({ result_url: finalOutput });

  } catch (err) {
    console.error("🔴 Erro interno fatal no /api/upload:", err);
    return res.status(500).json({ error: "Erro interno do servidor", details: err.message });
  }
});

// --- ROTA DE STATUS ---
app.get("/", (req, res) => {
  res.send(`✅ Backend do Provador (Versão: ${REPLICATE_VERSION_ID}) está a funcionar.`);
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
app.listen(port, () => {
  console.log(`✅ Backend rodando na porta ${port}`);
});
