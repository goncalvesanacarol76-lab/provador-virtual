import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fetch from 'node-fetch';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: '*'}));
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

const FALLBACK_MODEL_IMAGE_URL = "https://i.ibb.co/L519V1d/model-placeholder.png";
const FALLBACK_GARMENT_IMAGE_URL = "https://i.ibb.co/305R884/garment-placeholder.png";

app.post("/api/upload", upload.fields([
    { name: "model_image", maxCount: 1 },
    { name: "garment_image", maxCount: 1 }
]), async (req, res) => {

    try {
        if (!process.env.REPLICATE_API_TOKEN) {
            return res.status(500).json({ error: "API KEY DO REPLICATE NÃO SETADA" });
        }

    
        const MODEL_ID = "omnious/vella-1.5";

        const bodyData = {
            input: {
                model_image: FALLBACK_MODEL_IMAGE_URL,
                bottom_image: FALLBACK_GARMENT_IMAGE_URL
            }
        };

       
        const request = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: {
                "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: MODEL_ID,
                input: bodyData.input
            })
        });

        const prediction = await request.json();

        console.log("PREDICTION REQUEST:", prediction);

        if (!request.ok) {
            return res.status(500).json({ error: prediction.detail });
        }

        // 🔄 POLLING
        let resultUrl = null;

        for (let i = 0; i < 20; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));

            const poll = await fetch(prediction.urls.get, {
                headers: {
                    "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`
                }
            });

            const pollJson = await poll.json();

            console.log("STATUS:", pollJson.status);

            if (pollJson.status === "succeeded") {
                resultUrl = pollJson.output[0];
                break;
            }
        }

        if (!resultUrl) {
            return res.status(504).json({
                error: "Timeout esperando resultado da IA"
            });
        }

        res.json({ result_url: resultUrl });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro interno" });
    }
});

app.listen(port, () => {
    console.log("Server rodando na porta " + port);
});
