import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 5000;

// modelo correto catvton-flux
// ✅ ID correto do modelo catvton-flux
const REPLICATE_VERSION_ID =
  "cc41d1b963023987ed2ddf26e9264efcc96ee076640115c303f95b0010f6a958";

// --- MIDDLEWARES ---
app.use(cors({ origin: "*" }));
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
  limits: { fileSize: 10 * 1024 * 1024 } // limite 10MB
});

// ------------------------------------------------------
//                   ROTA DE UPLOAD
// ------------------------------------------------------
app.post(
  "/api/upload",
  upload.fields([
    console.log("🟢 Requisição recebida em /api/upload");

    try {
      // tokens obrigatórios
      // Tokens obrigatórios
      if (!process.env.REPLICATE_API_TOKEN) {
        return res.status(500).json({ error: "Falta REPLICATE_API_TOKEN" });
      }
      if (!process.env.HF_TOKEN) {
        return res.status(500).json({ error: "Falta HF_TOKEN do HuggingFace" });
      }

      // arquivos obrigatórios
      // Verificar arquivos
      if (!req.files.model_image || !req.files.garment_image) {
        return res.status(400).json({
          error: "Envie 'model_image' (pessoa) e 'garment_image' (roupa)."
      const personFile = req.files.model_image[0];
      const garmentFile = req.files.garment_image[0];

      // Converter para Base64
      const base64Person = `data:${personFile.mimetype};base64,${personFile.buffer.toString("base64")}`;
      const base64Garment = `data:${garmentFile.mimetype};base64,${garmentFile.buffer.toString("base64")}`;

      console.log("📤 Enviando imagens para Replicate...");
      console.log("📤 Enviando imagens para o modelo catvton-flux...");

      // criar a prediction
      // Criar prediction no Replicate
      const createResp = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {

        body: JSON.stringify({
          version: REPLICATE_VERSION_ID,
          input: {
            hf_token: process.env.HF_TOKEN, // obrigatório!!!
            hf_token: process.env.HF_TOKEN,
            image: base64Person,
            garment: base64Garment,
            try_on: true


      const getUrl = createJson.urls.get;

      console.log("⏳ Aguardando resultado...");
      console.log("⏳ Aguardando geração do resultado...");

      let output = null;

      // Polling — até 90 tentativas
      for (let i = 0; i < 90; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const pollResp = await fetch(getUrl, {
          headers: {
            Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`
          }
          headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` }
        });

        const pollJson = await pollResp.json();

        }

        if (pollJson.status === "failed") {
          console.log("❌ Falha do modelo:", pollJson);
          return res.status(500).json({
            error: "Falha do modelo",
            details: pollJson


      if (!output) {
        return res.status(504).json({
          error: "Timeout esperando resposta do modelo"
          error: "Timeout esperando resposta da IA"
        });
      }


  }
);

// ------------------------------------------------------
//                   ROTA STATUS
// ------------------------------------------------------
app.get("/", (req, res) => {
  res.send("Backend funcionando com catvton-flux!");
});

// ------------------------------------------------------
//                   START SERVER
// ------------------------------------------------------
app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
