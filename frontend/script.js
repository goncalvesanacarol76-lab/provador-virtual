// --- Variáveis Globais ---
const API_BASE_URL = 'https://provador-virtual-backend.onrender.com'; // <--- CORREÇÃO CRÍTICA AQUI
const API_UPLOAD_ENDPOINT = API_BASE_URL + '/api/upload';

let selectedGarmentFile = null;
let selectedModelFile = null; 
// ... (o restante do código é igual, mas vou incluir a função principal para contexto)

/**
 * Envia as imagens para o backend para processamento (Try-On).
 */
async function uploadImage() {
    console.log("Iniciando processo de upload para: " + API_UPLOAD_ENDPOINT);
    const resultDiv = document.getElementById('result');
    const statusMessage = document.getElementById('status-message');

    // Remove resultados anteriores e exibe a mensagem de carregamento
    resultDiv.innerHTML = '';
    statusMessage.textContent = "Processando... Isso pode levar cerca de 30 segundos. Aguarde!";
    statusMessage.classList.remove('hidden');

    try {
        const formData = new FormData();
        
        // Embora o backend use URLs de fallback por enquanto, é bom enviar os arquivos
        // para manter a estrutura da requisição correta
        if (selectedModelFile) {
             formData.append('model_image', selectedModelFile);
        }
        if (selectedGarmentFile) {
             formData.append('garment_image', selectedGarmentFile);
        }

        const response = await fetch(API_UPLOAD_ENDPOINT, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Erro da API:", errorData);
            throw new Error(`Erro na API: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        
        // Verifica se a URL de resultado foi recebida
        if (data.result_url) {
            statusMessage.textContent = "Sucesso! Imagem gerada pela IA:";
            
            const img = document.createElement('img');
            img.src = data.result_url;
            img.alt = "Imagem da Prova Virtual";
            img.className = "w-full h-auto object-contain rounded-lg shadow-2xl";
            
            // Adiciona a imagem ao contêiner de resultado
            resultDiv.appendChild(img);
        } else {
             // Caso a resposta da IA não tenha retornado a URL
            throw new Error("A IA não retornou a URL da imagem processada.");
        }


    } catch (error) {
        console.error("Erro ao tentar a prova virtual:", error);
        statusMessage.textContent = `Falha na prova virtual: ${error.message}. Verifique o console para mais detalhes.`;
        alert("Ops! Não foi possível carregar a camisa selecionada. Detalhes no console do navegador.");
    }
}


// --- Funções de UI (Seletor de Camisa, Upload de Arquivo, etc.) ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Configurar listeners para a seleção de camisas
    document.querySelectorAll('.garment-selector').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.garment-selector').forEach(btn => btn.classList.remove('selected'));
            e.currentTarget.classList.add('selected');

            // Define a URL da imagem do manequim (usada como fallback)
            // Para o projeto funcionar, você precisará modificar o backend para usar essa imagem
            // se o usuário não fizer upload de um manequim.
            const garmentImgSrc = e.currentTarget.querySelector('img').src;
            // No momento, o backend usa URLs fixas, mas esta linha selecionaria o manequim na UI
            // selectedGarmentFile = ... // (Aqui você teria que converter a URL para um arquivo se fosse usar localmente)
            
            // Exibir o manequim selecionado no preview
            const previewImage = document.getElementById('garment-preview');
            if (previewImage) {
                previewImage.src = garmentImgSrc;
                previewImage.classList.remove('hidden');
                document.getElementById('garment-placeholder').classList.add('hidden');
            }
        });
    });

    // 2. Configurar o listener para o upload da foto do modelo
    const modelFileInput = document.getElementById('model-file-input');
    const modelPreview = document.getElementById('model-preview');

    modelFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedModelFile = file; // Armazena o arquivo
            
            const reader = new FileReader();
            reader.onload = (e) => {
                modelPreview.src = e.target.result;
                modelPreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });


    // 3. Configurar o listener para o botão de "Testar Roupa"
    const tryOnButton = document.getElementById('try-on-button');
    if (tryOnButton) {
        tryOnButton.addEventListener('click', uploadImage);
    }
});
