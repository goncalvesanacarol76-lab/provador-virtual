import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fetch from 'node-fetch';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// upload em memória → necessário pro base64
const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/upload", upload.fields([
    { name: "model_image", maxCount: 1 },   // foto da pessoa
    { name: "garment_image", maxCount: 1 }  // camisa
]), async (req, res) => {

    try {
        if (!process.env.REPLICATE_API_TOKEN) {
            return res.status(500).json({ error: "API KEY DO REPLICATE NÃO SETADA" });
        }

        if (!req.files.model_image) {
            return res.status(400).json({ error: "Imagem da pessoa não enviada" });
        }
        if (!req.files.garment_image) {
            return res.status(400).json({ error: "Imagem da camisa não enviada" });
        }

        // converter imagens para base64
        const base64Model = `data:${req.files.model_image[0].mimetype};base64,${req.files.model_image[0].buffer.toString("base64")}`;
        const base64Garment = `data:${req.files.garment_image[0].mimetype};base64,${req.files.garment_image[0].buffer.toString("base64")}`;

        const MODEL_ID = "omnious/vella-1.5";

        // criar prediction
        const reqPrediction = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: {
                "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: MODEL_ID,
                input: {
                    model_image: base64Model,   // foto do usuário
                    bottom_image: base64Garment // camisa selecionada
                }
            })
        });

        const prediction = await reqPrediction.json();

        if (!reqPrediction.ok) {
            return res.status(500).json({ error: prediction.detail || "Erro na criação da prediction" });
        }

        // polling
        let finalOutput = null;

        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 2000));

            const poll = await fetch(prediction.urls.get, {
                headers: { "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}` }
            });

            const pollJson = await poll.json();

            console.log("STATUS:", pollJson.status);

            if (pollJson.status === "succeeded") {
                finalOutput = pollJson.output[0];
                break;
            }
        }

        if (!finalOutput) {
            return res.status(504).json({ error: "Timeout esperando resultado da IA" });
        }

        res.json({ result_url: finalOutput });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro interno" });
    }
});

app.listen(port, () => {
    console.log("Server rodando na porta " + port);
});
