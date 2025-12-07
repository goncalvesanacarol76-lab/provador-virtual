import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 5000;

const REPLICATE_VERSION_ID =
  "cf5cb07a25e726fe2fac166a8c5ab52ddccd48657741670fb09d9954d4d8446f"; // Modelo novo FLUX TRY-ON

// --- MIDDLEWARES ---
app.use(cors({ origin: "*" }));
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// ------------------------------------------------------
//                 ROTA DE UPLOAD
// ------------------------------------------------------
app.post(
  "/api/upload",
  upload.fields([
    { name: "model_image", maxCount: 1 }, // Foto da pessoa (frontend)
    { name: "garment_image", maxCount: 1 } // Foto da roupa (frontend)
  ]),
  async (req, res) => {
    console.log("🟢 Requisição recebida em /api/upload");

    try {
      // 1. Verificar token
      if (!process.env.REPLICATE_API_TOKEN) {
        console.error("ERRO: REPLICATE_API_TOKEN não configurada.");
        return res
          .status(500)
          .json({ error: "REPLICATE_API_TOKEN não configurada no Render." });
      }

      // 2. Verificação de arquivos
      if (
        !req.files ||
        !req.files.model_image ||
        !req.files.garment_image
      ) {
        return res.status(400).json({
          error: "Envie 'model_image' (pessoa) e 'garment_image' (roupa)."
        });
      }

      const personFile = req.files.model_image[0];
      const clothFile = req.files.garment_image[0];

      // 3. Converter para Base64
      const base64Person = `data:${personFile.mimetype};base64,${personFile.buffer.toString(
        "base64"
      )}`;
      const base64Cloth = `data:${clothFile.mimetype};base64,${clothFile.buffer.toString(
        "base64"
      )}`;

      console.log("Imagens convertidas. Enviando para o Replicate...");

      // 4. Criar predição no Replicate
      const createResp = await fetch(
        "https://api.replicate.com/v1/predictions",
        {
          method: "POST",
          headers: {
            Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            version: REPLICATE_VERSION_ID,
            input: {
              person_image: base64Person, // Nomes corretos do novo modelo
              clothing_image: base64Cloth
            }
          })
        }
      );

      const createJson = await createResp.json();

      if (!createResp.ok) {
        console.error("❌ ERRO AO CRIAR PREDICTION:", createJson);
        return res.status(createResp.status).json({
          error: createJson.detail || "Erro criando prediction no Replicate.",
          details: createJson
        });
      }

      // 5. Polling para esperar o resultado
      let finalOutput = null;
      const getUrl = createJson.urls?.get;

      console.log("🕒 Aguardando geração da IA...");

      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 2000));

        const pollResp = await fetch(getUrl, {
          headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` }
        });

        const pollJson = await pollResp.json();

        console.log(`⏳ Status: ${pollJson.status} (${i + 1}/40)`);

        if (pollJson.status === "succeeded") {
          finalOutput = pollJson.output;
          break;
        }

        if (pollJson.status === "failed") {
          console.error("❌ Falhou:", pollJson);
          return res.status(500).json({
            error: "Falha no modelo do Replicate.",
            details: pollJson
          });
        }
      }

      if (!finalOutput) {
        return res.status(504).json({
          error: "Timeout esperando resposta da IA."
        });
      }

      console.log("✅ Sucesso! Resultado enviado ao frontend.");
      return res.json({ result_url: finalOutput });

    } catch (err) {
      console.error("🔴 ERRO FATAL:", err);
      return res.status(500).json({
        error: "Erro interno do servidor.",
        details: err.message
      });
    }
  }
);

// ------------------------------------------------------
//                   ROTA STATUS
// ------------------------------------------------------
app.get("/", (req, res) => {
  res.send("Backend do Provador Virtual está funcionando!");
});

// ------------------------------------------------------
//              INICIAR SERVIDOR
// ------------------------------------------------------
app.listen(port, () => {
  console.log(`🚀 Backend rodando na porta ${port}`);
});
