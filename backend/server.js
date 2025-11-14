import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import fetch from 'node-fetch';
import multer from 'multer';

import 'dotenv/config';

const app = express();
const port = process.env.PORT || 5000;
const pump = promisify(pipeline);

// Configuração CORS CRÍTICA: Permite todas as origens
app.use(cors({
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração do multer para upload de arquivos
const upload = multer({ dest: 'uploads/' });


const REPLICATE_MODEL_VERSION = 'c2e8b23c2182069b2d84715560b4353d9e334a1789c623910c28ec2333b1e847'; 

const FALLBACK_MODEL_IMAGE_URL = 'https://i.ibb.co/L519V1d/model-placeholder.png'; // Modelo (Pessoa)
const FALLBACK_GARMENT_IMAGE_URL = 'https://i.ibb.co/305R884/garment-placeholder.png'; // Peça de Roupa


app.get('/', (req, res) => {
    res.send('Backend do Provador Virtual está rodando e pronto para receber requisições.');
});


// Rota alterada para /api/upload para corresponder ao que o Frontend está chamando.
app.post('/api/upload', upload.fields([
    { name: 'model_image', maxCount: 1 },
    { name: 'garment_image', maxCount: 1 }
]), async (req, res) => {

    // Nota: O código de tryon abaixo está usando apenas URLs de fallback
    // e não os arquivos de upload do usuário (req.files). 
    // Para usar os arquivos, é necessário fazer upload para um serviço como 
    // AWS S3 ou Cloudinary para obter URLs públicas, pois o Replicate 
    // requer URLs, não arquivos locais.

    try {
        console.log('Requisição /api/upload recebida.');
        
        const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
        if (!REPLICATE_API_TOKEN) {
            console.error("ERRO FATAL: REPLICATE_API_TOKEN não está configurada.");
            return res.status(500).json({ 
                error: "Chave API não configurada no servidor. Por favor, adicione a variável REPLICATE_API_TOKEN no Render.",
                details: "MISSING_API_KEY"
            });
        }

        console.log('Usando URLs de imagens de exemplo para a chamada Replicate...');

        // Chamada à API Replicate
        const apiResponse = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Token ${REPLICATE_API_TOKEN}`, 
            },
          body: JSON.stringify({
              version: REPLICATE_MODEL_VERSION,
             input: {
                model_image: FALLBACK_MODEL_IMAGE_URL,     // modelo (pessoa)
                top_image: FALLBACK_GARMENT_IMAGE_URL,     // camisa
                num_outputs: 1,
             output_format: "webp",
        seed: 42                                    // opcional, só p/ ser reproduzível
  },
}),

        });
        
        const prediction = await apiResponse.json();

    
        if (apiResponse.status === 402) {
            console.error('Erro na chamada Replicate: 402 Payment Required.');
            return res.status(402).json({ 
                error: "Erro 402: Pagamento Requerido. Verifique o saldo da sua conta Replicate.",
                details: "PAYMENT_REQUIRED"
            });
        }

        if (apiResponse.status !== 201) {
            console.error('Erro na chamada Replicate (Status != 201):', prediction);
            return res.status(apiResponse.status).json({ 
                error: prediction.detail || 'Erro na chamada inicial ao Replicate',
                details: "REPLICATE_API_ERROR"
            });
        }

        
        let resultUrl = null;
        for (let i = 0; i < 20; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const pollResponse = await fetch(prediction.urls.get, {
                headers: {
                    Authorization: `Token ${REPLICATE_API_TOKEN}`,
                },
            });

            const pollResult = await pollResponse.json();

            if (pollResult.status === 'succeeded') {
                // O modelo Inpaint/Tryon geralmente retorna a imagem gerada no output[0]
                resultUrl = pollResult.output ? pollResult.output[0] : null; 
                break;
            } else if (pollResult.status === 'failed' || pollResult.status === 'canceled') {
                console.error('Predição falhou ou foi cancelada:', pollResult);
                return res.status(500).json({ error: 'Geração de imagem falhou no Replicate.', details: "GENERATION_FAILED" });
            }
        }
        
        if (!resultUrl) {
            return res.status(504).json({ error: 'Tempo limite esgotado esperando o resultado da IA.', details: "TIMEOUT" });
        }

        // Retorna a URL da imagem gerada para o Frontend
        res.json({ result_url: resultUrl });

    } catch (error) {
        console.error('Erro interno no servidor (Try-On):', error);
        res.status(500).json({ error: 'Erro interno ao processar a requisição.', details: "INTERNAL_SERVER_ERROR" });
    } 
});

app.listen(port, () => {
    console.log(`Backend com Replicate rodando na porta: ${port}`);

    if (process.env.REPLICATE_API_TOKEN) {
        console.log("REPLICATE_TOKEN_LOADED: true");
    } else {
        console.log("REPLICATE_TOKEN_LOADED: false. Configure REPLICATE_API_TOKEN no Render!");
    }
});
