import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 5000;

const REPLICATE_VERSION_ID =
  "dfda793f95fb788961b38ce72978a350cd7b689c17bbfeb7e1048fc9c7c4849d";

app.use(cors({ origin: "*" }));
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});


app.post(
  "/api/upload",
  upload.fields([
    { name: "model_image", maxCount: 1 },   // pessoa
    { name: "garment_image", maxCount: 1 }  // roupa
  ]),
  async (req, res) => {
    console.log("🟢 Requisição recebida em /api/upload");

    try {
      if (!process.env.REPLICATE_API_TOKEN) {
        return res.status(500).json({ error: "Falta REPLICATE_API_TOKEN" });
      }

      if (!req.files.model_image || !req.files.garment_image) {
        return res.status(400).json({
          error: "Envie 'model_image' (pessoa) e 'garment_image' (roupa)."
        });
      }

      const personFile = req.files.model_image[0];
      const garmentFile = req.files.garment_image[0];

      const base64Person = `data:${personFile.mimetype};base64,${personFile.buffer.toString("base64")}`;
      const base64Garment = `data:${garmentFile.mimetype};base64,${garmentFile.buffer.toString("base64")}`;

      console.log("📤 Enviando imagens para oot_diffusion_dc...");

      // Criar prediction no Replicate
      const createResp = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          version: REPLICATE_VERSION_ID,
          input: {
            seed: 0,
            steps: 15,
            guidance_scale: 2,
            garment_category: "upperbody", // ou lowerbody — você escolhe
            model_image: base64Person,
            garment_image: base64Garment
          }
        })
      });

      const createJson = await createResp.json();

      if (!createResp.ok) {
        console.log("❌ Erro ao criar prediction:", createJson);
        return res.status(500).json({
          error: createJson.detail || "Erro criando prediction.",
          details: createJson
        });
      }

      const getUrl = createJson.urls.get;

      console.log("⏳ Aguardando geração do resultado...");

      let outputImages = null;

      // Polling — aguarda resultado
      for (let i = 0; i < 90; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const pollResp = await fetch(getUrl, {
          headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` }
        });

        const pollJson = await pollResp.json();

        console.log(`Status: ${pollJson.status} (${i + 1}/90)`);

        if (pollJson.status === "succeeded") {
          outputImages = pollJson.output; // Esse modelo retorna 4 imagens
          break;
        }

        if (pollJson.status === "failed") {
          console.log("❌ Falha do modelo:", pollJson);
          return res.status(500).json({
            error: "Falha do modelo",
            details: pollJson
          });
        }
      }

      if (!outputImages) {
        return res.status(504).json({
          error: "Timeout esperando resposta da IA"
        });
      }

      console.log("✅ Sucesso! Enviando resultado ao frontend.");

      res.json({ result_urls: outputImages });

    } catch (err) {
      console.error("🔥 ERRO FATAL:", err);
      res.status(500).json({
        error: "Erro interno",
        details: err.message
      });
    }
  }
);


app.get("/", (req, res) => {
  res.send("Backend rodando com oot_diffusion_dc!");
});

app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
