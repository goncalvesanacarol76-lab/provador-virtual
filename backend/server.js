// server.js
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Replicate from "replicate";
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: "*" }));
app.use(express.json());

// Upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

app.post("/api/upload", upload.fields([
  { name: "model_image", maxCount: 1 },
  { name: "garment_image", maxCount: 1 }
]), async (req, res) => {

  try {
    if (!req.files?.model_image || !req.files?.garment_image) {
      return res.status(400).json({ error: "Envie model_image e garment_image." });
    }

    // Convertendo para base64 data URI
    const toDataURI = (file) =>
      `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

    const modelImage = toDataURI(req.files.model_image[0]);
    const garmentImage = toDataURI(req.files.garment_image[0]);

    console.log("Chamando modelo omnious/vella-1.5...");

    // CHAMADA CORRETA — sem version
    const output = await replicate.run(
      "omnious/vella-1.5",
      {
        input: {
          model_image: modelImage,
          bottom_image: garmentImage
        }
      }
    );

    let resultUrl = null;

    // Output pode ser array de objetos
    if (Array.isArray(output) && output[0]?.url) {
      resultUrl = output[0].url;
    } else if (Array.isArray(output) && typeof output[0] === "string") {
      resultUrl = output[0];
    } else if (output?.url) {
      resultUrl = output.url;
    }

    if (!resultUrl) {
      return res.status(500).json({
        error: "Não foi possível extrair URL da imagem gerada.",
        output
      });
    }

    return res.json({ result_url: resultUrl });

  } catch (err) {
    console.error("Erro no backend:", err);
    return res.status(500).json({ error: "Erro interno", details: err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend rodando na porta ${port}`);
});
