// server.js
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fetch from 'node-fetch';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 5000;

// CORS público (se quiser restringir, coloque a origem do seu front)
app.use(cors({ origin: '*' }));
app.use(express.json());

// multer em memória (evita salvar em disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 6 * 1024 * 1024 // limite 6MB por arquivo (ajuste se quiser)
  }
});

app.post("/api/upload", upload.fields([
    { name: "model_image", maxCount: 1 },   // foto da pessoa
    { name: "garment_image", maxCount: 1 }  // imagem da camisa
]), async (req, res) => {

    try {
        // checagens básicas
        if (!process.env.REPLICATE_API_TOKEN) {
            return res.status(500).json({ error: "REPLICATE_API_TOKEN não configurada." });
        }

        if (!req.files || !req.files.model_image || !req.files.garment_image) {
            return res.status(400).json({ error: "Envie model_image e garment_image." });
        }

        // converte para base64 inline (data URI)
        const modelFile = req.files.model_image[0];
        const garmentFile = req.files.garment_image[0];

        const base64Model = `data:${modelFile.mimetype};base64,${modelFile.buffer.toString('base64')}`;
        const base64Garment = `data:${garmentFile.mimetype};base64,${garmentFile.buffer.toString('base64')}`;

        const MODEL_ID = "c2e8b23c2182069b2d84715560b4353d9e334a1789c623910c28ec2333b1e847";

        // Criar prediction no Replicate
        const createResp = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: {
                "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                version: MODEL_ID,
                input: {
                    model_image: base64Model,
                    top_image: base64Garment
                }
            })
        });

        const createJson = await createResp.json();
        console.log("Create prediction response:", createJson);

        if (!createResp.ok) {
            // retorna a mensagem do Replicate
            return res.status(createResp.status || 500).json({
                error: createJson.detail || "Erro criando a prediction no Replicate.",
                raw: createJson
            });
        }

        // Polling para aguardar o resultado
        let finalOutput = null;
        const getUrl = createJson.urls?.get;
        if (!getUrl) {
            return res.status(500).json({ error: "Resposta inesperada do Replicate (sem urls.get)." });
        }

        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 2000)); // 2s

            const pollResp = await fetch(getUrl, {
                headers: { "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}` }
            });
            const pollJson = await pollResp.json();
            console.log("poll status:", pollJson.status);

            if (pollJson.status === "succeeded") {
                // output normalmente é array de URLs ou objetos
                // alguns modelos retornam array de strings ou array de objetos
                finalOutput = Array.isArray(pollJson.output) ? pollJson.output[0] : pollJson.output;
                break;
            }

            if (pollJson.status === "failed" || pollJson.status === "canceled") {
                return res.status(500).json({ error: "Geração falhou no Replicate", details: pollJson });
            }
        }

        if (!finalOutput) {
            return res.status(504).json({ error: "Timeout aguardando o resultado do modelo." });
        }

        // finalOutput pode ser uma URL (string) ou objeto com .url()
        // garantir uma URL string para enviar ao frontend
        let resultUrl = finalOutput;
        // se for objeto que tem url() (quando usando SDK), tenta extrair
        try {
          if (typeof finalOutput === 'object' && finalOutput !== null) {
            if (finalOutput.url) resultUrl = finalOutput.url;
            else if (finalOutput[0] && typeof finalOutput[0] === 'string') resultUrl = finalOutput[0];
          }
        } catch (_) {}

        return res.json({ result_url: resultUrl });

    } catch (err) {
        console.error("Erro interno /api/upload:", err);
        return res.status(500).json({ error: "Erro interno do servidor", details: err.message });
    }
});

app.listen(port, () => {
    console.log(`Backend rodando na porta ${port}`);
});
