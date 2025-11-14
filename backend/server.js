import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fetch from 'node-fetch';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 
  }
});

const REPLICATE_VERSION_ID = "c2e8b23c2182069b2d84715560b4353d9e334a1789c623910c28ec2333b1e847";

app.post("/api/upload", upload.fields([
  { name: "model_image", maxCount: 1 },
  { name: "garment_image", maxCount: 1 }
]), async (req, res) => {

  console.log("🟢 Requisição recebida em /api/upload");

  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error("ERRO: REPLICATE_API_TOKEN não configurada no Render.");
      return res.status(500).json({ error: "REPLICATE_API_TOKEN não configurada." });
    }

    if (!req.files || !req.files.model_image || !req.files.garment_image) {
      console.error("ERRO: Faltam ficheiros na requisição.");
      return res.status(400).json({ error: "É necessário enviar 'model_image' e 'garment_image'." });
    }

    const modelFile = req.files.model_image[0];
    const garmentFile = req.files.garment_image[0];

    const base64Model = `data:${modelFile.mimetype};base64,${modelFile.buffer.toString('base64')}`;
    const base64Garment = `data:${garmentFile.mimetype};base64,${garmentFile.buffer.toString('base64')}`;
    
    console.log("Imagens convertidas. A contactar o Replicate...");

    const createResp = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`, 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        version: REPLICATE_VERSION_ID, 
        input: {
          model_image: base64Model,
          top_image: base64Garment 
        }
      })
    });

    const createJson = await createResp.json();

    if (!createResp.ok) {
      console.error("ERRO do Replicate (ao criar):", createJson.detail);
      return res.status(createResp.status || 500).json({ error: createJson.detail || "Erro criando a prediction no Replicate." });
    }

    let finalOutput = null;
    const getUrl = createJson.urls?.get;
    if (!getUrl) {
      return res.status(500).json({ error: "Resposta inesperada do Replicate (sem urls.get)." });
    }

    console.log("Predição criada. A aguardar resultado...");
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000)); 
      const pollResp = await fetch(getUrl, {
        headers: { "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}` }
      });
      const pollJson = await pollResp.json();
      console.log("...status:", pollJson.status);

      if (pollJson.status === "succeeded") {
        finalOutput = Array.isArray(pollJson.output) ? pollJson.output[0] : pollJson.output;
        break;
      }
      if (pollJson.status === "failed" || pollJson.status === "canceled") {
        console.error("ERRO: Geração falhou no Replicate:", pollJson);
        return res.status(500).json({ error: "Geração falhou no Replicate", details: pollJson });
      }
    }

    if (!finalOutput) {
      console.error("ERRO: Timeout (60s) aguardando o modelo.");
      return res.status(504).json({ error: "Timeout aguardando o resultado do modelo." });
    }

    console.log("✅ Sucesso! A enviar URL para o frontend:", finalOutput);
    return res.json({ result_url: finalOutput });

  } catch (err) {
    console.error("Erro interno fatal no /api/upload:", err);
    return res.status(500).json({ error: "Erro interno do servidor", details: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Backend do Provador (Modo 1-Passo) está a funcionar.");
});

app.listen(port, () => {
  console.log(`✅ Backend (Modo 1-Passo) rodando na porta ${port}`);
});
