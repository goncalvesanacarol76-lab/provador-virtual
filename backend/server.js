import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 5000;

// ✅ Versão do modelo qiweiii/oot_diffusion_dc, que você usou no exemplo JSON
const REPLICATE_VERSION_ID =
  "dfda793f95fb788961b38ce72978a350cd7b689c17bbfeb7e1048fc9c7c4849d";

app.use(cors({ origin: "*" }));
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // limite 10MB
});


app.post(
  "/api/upload",
  // ✅ Corrigido: `upload.fields` com os nomes corretos e a função de rota `(req, res)`
  upload.fields([
    { name: "model_image", maxCount: 1 },
    { name: "garment_image", maxCount: 1 },
    // Adicionamos um input opcional para a categoria, mas vamos forçar "upperbody" por enquanto
    { name: "garment_category", maxCount: 1 }, 
  ]),
  async (req, res) => {
    console.log("🟢 Requisição recebida em /api/upload");

    try {
      // ✅ Token obrigatório
      if (!process.env.REPLICATE_API_TOKEN) {
        return res.status(500).json({ error: "Falta REPLICATE_API_TOKEN" });
      }
      
      // O modelo qiweiii/oot_diffusion_dc NÃO PRECISA de HF_TOKEN, então removemos a verificação
      
      // ✅ Verificar arquivos
      if (!req.files || !req.files.model_image || !req.files.garment_image) {
        return res.status(400).json({
          error: "Envie 'model_image' (pessoa) e 'garment_image' (roupa)."
        });
      }

      const personFile = req.files.model_image[0];
      const garmentFile = req.files.garment_image[0];

      // Converter para Base64
      const base64Person = `data:${personFile.mimetype};base64,${personFile.buffer.toString("base64")}`;
      const base64Garment = `data:${garmentFile.mimetype};base64,${garmentFile.buffer.toString("base64")}`;

      console.log("📤 Enviando imagens para o modelo qiweiii/oot_diffusion_dc...");

      // Categoria da roupa (assumindo camisas = upperbody)
      // Você pode tentar pegar do req.body ou req.files se mandar via FormData,
      // mas fixar para "upperbody" é mais simples no seu caso de camisas.
      const garmentCategory = "upperbody"; 

      // Criar a prediction no Replicate
      const createResp = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // ✅ Usar o token de Autorização
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`
        },
        body: JSON.stringify({
          version: REPLICATE_VERSION_ID,
          input: {
            // Parâmetros CORRETOS para qiweiii/oot_diffusion_dc
            model_image: base64Person,
            garment_image: base64Garment,
            garment_category: garmentCategory, 
            seed: 0, 
            steps: 15,
            guidance_scale: 2, 
          }
        })
      });

      const createJson = await createResp.json();
      
      if (!createResp.ok || createJson.error) {
          console.error("❌ Falha ao criar prediction:", createJson);
          return res.status(createResp.status).json({
              error: "Falha ao iniciar a IA",
              details: createJson.error || "Erro desconhecido"
          });
      }

      const getUrl = createJson.urls.get;

      console.log("⏳ Aguardando resultado...");

      let output = null;

      // Polling — até 90 tentativas (máximo de 3 minutos)
      for (let i = 0; i < 90; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Espera 2 segundos

        const pollResp = await fetch(getUrl, {
          headers: { 
            Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` 
          }
        });

        const pollJson = await pollResp.json();

        if (pollJson.status === "succeeded") {
          output = pollJson.output;
          console.log("✅ Sucesso! Resultados obtidos.");
          break; // Sai do loop
        }

        if (pollJson.status === "failed") {
          console.log("❌ Falha do modelo:", pollJson);
          return res.status(500).json({
            error: "Falha do modelo",
            details: pollJson
          });
        }
        
        // Se estiver em 'processing', 'starting', ou 'queued', continua o polling
      }

      if (!output) {
        return res.status(504).json({
          error: "Timeout esperando resposta da IA"
        });
      }

      // ✅ Retorna as URLs de resultado
      return res.status(200).json({
        message: "Imagens geradas com sucesso!",
        result_urls: output 
      });

    } catch (error) {
      console.error("❌ Erro interno do servidor:", error);
      res.status(500).json({
        error: "Erro interno do servidor",
        details: error.message
      });
    }
  }
);


app.get("/", (req, res) => {
  res.send("Backend funcionando com qiweiii/oot_diffusion_dc!"); // ✅ Mensagem atualizada
});


app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
