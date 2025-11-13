import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import fetch from "node-fetch"; 

dotenv.config();
console.log("REPLICATE_TOKEN_LOADED:", !!process.env.REPLICATE_API_TOKEN);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// --- CORREÇÃO CORS CRÍTICA ---
// Especifica que o Backend só deve aceitar pedidos do seu Frontend no Render.
app.use(cors({
    origin: "https://provador-virtual-1.onrender.com"
}));
// -----------------------------

app.use(express.json());

const uploads = {};
const tasks = {};

app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

    const fakeId = "id_" + Math.random().toString(36).substring(2, 10);
    uploads[fakeId] = {
        buffer: req.file.buffer,
        type: req.body.type || "unknown",
        filename: req.file.originalname,
    };

    console.log(`🟢 Upload recebido (${req.body.type}): ${req.file.originalname}`);
    res.json({ id: fakeId });
});

app.post("/api/tryon", async (req, res) => {
    try {
        const { person_id, cloth_id, task_id } = req.body;

        if (task_id && tasks[task_id]) {
            const task = tasks[task_id];
            return res.json(task);
        }

        if (!uploads[person_id] || !uploads[cloth_id]) {
            return res.status(400).json({ error: "IDs inválidos de pessoa ou roupa." });
        }

        console.log("Enviando imagens para Replicate...");

        const LATEST_VELLA_VERSION_ID =
            "15411671930948c2d20b81fa41e1af6075f6181b2e38477bdd3526d50affe4a9";

        const predictionResponse = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                version: LATEST_VELLA_VERSION_ID,
                input: {
                    model_image: `data:${uploads[person_id].type};base64,${uploads[
                        person_id
                    ].buffer.toString("base64")}`,
                    top_image: `data:${uploads[cloth_id].type};base64,${uploads[
                        cloth_id
                    ].buffer.toString("base64")}`,
                },
            }),
        });

        if (!predictionResponse.ok) {
            const errText = await predictionResponse.text();
            console.error("Erro ao criar predição:", errText);
            return res.status(500).json({
                error:
                    "Erro ao criar predição no Replicate. Verifique se o token está correto ou se há créditos suficientes.",
            });
        }

        let prediction = await predictionResponse.json();

        if (!prediction.urls || !prediction.urls.get) {
            console.error("Resposta inesperada do Replicate:", prediction);
            return res.status(500).json({
                error: "Resposta inesperada do Replicate. Verifique o modelo usado.",
            });
        }

        console.log("Aguardando processamento do modelo...");
        while (prediction.status !== "succeeded" && prediction.status !== "failed") {
            console.log("Status atual:", prediction.status);
            await new Promise((resolve) => setTimeout(resolve, 4000));
            const statusRes = await fetch(prediction.urls.get, {
                headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
            });
            prediction = await statusRes.json();
        }

        if (prediction.status === "succeeded") {
            const imageUrl = Array.isArray(prediction.output)
                ? prediction.output[0]
                : prediction.output;

            console.log("✅ Imagem gerada com sucesso Aninhaa!");
            console.log("URL de Resultado:", imageUrl);

            const newTaskId = "task_" + Math.random().toString(36).substring(2, 10);
            tasks[newTaskId] = {
                task_id: newTaskId,
                status: "COMPLETED",
                result_url: imageUrl,
            };

            return res.json(tasks[newTaskId]);
        } else {
            console.error("Falha na geração:", prediction.error);
            return res.status(500).json({
                error:
                    "O modelo falhou ao gerar a imagem. Pode ser incompatibilidade da imagem, formato incorreto ou erro interno do Replicate.",
            });
        }
    } catch (error) {
        console.error("Erro Replicate:", error);
        res.status(500).json({
            error:
                "Falha na integração com Replicate: " +
                (error.message || "Erro desconhecido."),
        });
    }
});

const PORT = 5000;
app.listen(PORT, () =>
    console.log(`✅ Backend com Replicate rodando em http://localhost:${PORT}`)
);