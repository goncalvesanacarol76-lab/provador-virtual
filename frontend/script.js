document.addEventListener('DOMContentLoaded', () => {
    // Certifique-se de que esta URL está correta (o endereço do seu backend no Render)
    const API_BASE_URL = 'https://provador-virtual-backend.onrender.com';
    const API_UPLOAD_ENDPOINT = API_BASE_URL + '/api/upload';

    let selectedGarmentFile = null;
    let selectedModelFile = null;

    const resultsContainer = document.getElementById('resultsContainer');
    const tryonBtn = document.getElementById('tryonBtn');
    const personInput = document.getElementById('personInput');
    const personPreview = document.getElementById('personPreview');
    const statusMessage = document.getElementById('status-message');
    const progressContainer = document.getElementById('progress-container');
    const cameraPreview = document.getElementById('cameraPreview');
    const openCameraBtn = document.getElementById('openCameraBtn');
    const captureBtn = document.getElementById('captureBtn');

    let cameraStream = null;

    async function uploadImage() {
        if (!resultsContainer || !selectedModelFile || !selectedGarmentFile) {
            statusMessage.textContent = "Erro: Arquivo de pessoa ou roupa ausente.";
            return;
        }

        console.log("Iniciando upload para:", API_UPLOAD_ENDPOINT);
        resultsContainer.innerHTML = ""; // Limpa resultados anteriores
        
        // Esconde o container principal enquanto carrega
        document.getElementById('result').classList.add('hidden'); 
        
        statusMessage.classList.remove('hidden');
        statusMessage.textContent = "Processando... Isso pode levar até 3 minutos dependendo da fila do Replicate.";
        progressContainer.classList.remove('hidden');
        tryonBtn.disabled = true; 
        
        try {
            const formData = new FormData();
            formData.append('model_image', selectedModelFile); 
            formData.append('garment_image', selectedGarmentFile); 

            const response = await fetch(API_UPLOAD_ENDPOINT, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Erro desconhecido ao processar imagem");
            }

            console.log("Resposta do backend:", data);

            if (data.result_urls && Array.isArray(data.result_urls)) {
                statusMessage.textContent = "Sucesso! Imagens geradas:";
                
                // ✅ CORREÇÃO: Exibe o container de resultados
                document.getElementById('result').classList.remove('hidden'); 
                
                // Limpa e preenche o container
                resultsContainer.innerHTML = "";
                data.result_urls.forEach((imgURL, index) => {
                    const block = document.createElement("div");
                    block.className = "result-block";

                    block.innerHTML = `
                        <h3>Resultado ${index + 1}</h3>
                        <img src="${imgURL}" class="result-image">
                        <button class="downloadSingle">Baixar</button>
                    `;

                    block.querySelector(".downloadSingle").onclick = () => {
                        const a = document.createElement('a');
                        a.href = imgURL;
                        a.download = `resultado_provador_fanaticos_${index + 1}.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    };

                    resultsContainer.appendChild(block);
                });
            } else {
                throw new Error("A IA não retornou as URLs das imagens processadas.");
            }
        } catch (error) {
            console.error("Erro na prova virtual:", error);
            statusMessage.textContent = `Falha na prova virtual: ${error.message}.`;
        } finally {
            progressContainer.classList.add('hidden');
            checkReadyToTryOn(); 
        }
    }

    function checkReadyToTryOn() {
        tryonBtn.disabled = !(selectedGarmentFile && selectedModelFile);
        if (tryonBtn.disabled) {
            statusMessage.textContent = "Aguardando foto e camisa selecionada...";
            statusMessage.classList.remove('hidden');
        } else {
            statusMessage.textContent = "Tudo pronto! Clique em 'Testar roupa'.";
        }
    }

    tryonBtn.addEventListener('click', () => {
        if (!tryonBtn.disabled) uploadImage();
    });

    // UPLOAD da pessoa
    personInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        selectedModelFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
            personPreview.src = ev.target.result;
            personPreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
        stopCameraIfRunning();
        checkReadyToTryOn();
    });

    // --------------------------------------
    // Câmera e Captura
    // --------------------------------------

    async function startCamera() {
        stopCameraIfRunning(); 
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user' } 
            });
            cameraPreview.srcObject = cameraStream;
            cameraPreview.classList.remove('hidden');
            captureBtn.classList.remove('hidden');
            personPreview.classList.add('hidden'); 
            statusMessage.textContent = "Ajuste a câmera para uma pose de corpo inteiro.";
        } catch(e) {
            alert("Não foi possível acessar a câmera. Verifique as permissões. (Erro: " + e.name + ")");
        }
    }

    function stopCameraIfRunning() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(t => t.stop());
            cameraStream = null;
        }
        cameraPreview.classList.add('hidden');
        captureBtn.classList.add('hidden');
    }

    openCameraBtn.addEventListener('click', startCamera);

    captureBtn.addEventListener('click', () => {
        if (!cameraStream) return;
        const canvas = document.createElement('canvas');
        canvas.width = cameraPreview.videoWidth;
        canvas.height = cameraPreview.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (!blob) return;
            selectedModelFile = new File([blob], 'foto-camera.png', { type: 'image/png' }); 
            personPreview.src = URL.createObjectURL(blob); 
            personPreview.classList.remove('hidden');
            stopCameraIfRunning();
            checkReadyToTryOn();
        }, 'image/png');
    });

    // --------------------------------------
    // CARROSSEL (Camisa) - Lógica de Carregamento
    // --------------------------------------
    const params = new URLSearchParams(window.location.search);
    const urlCamisaRecebida = params.get('camisa');
    const nomeCamisaRecebido = params.get('nome');
    const primeiroItemCarrossel = document.querySelector('#shirtCarousel .shirt-item');

    async function selectAndLoadGarment(url, name) {
        if (!primeiroItemCarrossel || !url) return;

        const imgElement = primeiroItemCarrossel.querySelector('img');
        const pElement = primeiroItemCarrossel.querySelector('p');

        // 1. Atualizar a UI
        if (imgElement) {
            imgElement.src = url;
            imgElement.alt = name || "Camisa Selecionada";
        }
        if (pElement) {
            pElement.textContent = name || "Camisa Selecionada";
        }

        // 2. Baixar a imagem e criar o File
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            selectedGarmentFile = new File([blob], "camisa.png", { type: blob.type }); 
            primeiroItemCarrossel.classList.add('selected');
            checkReadyToTryOn();
        } catch(error) {
            console.error("Falha ao carregar a camisa:", error);
            selectedGarmentFile = null;
            alert("Não foi possível carregar a camisa selecionada. Verifique a URL.");
            checkReadyToTryOn(); 
        }
    }

    // Inicialização: Se a camisa veio pela URL, carrega ela.
    if (urlCamisaRecebida) {
        selectAndLoadGarment(urlCamisaRecebida, nomeCamisaRecebido);
    } else {
        if (primeiroItemCarrossel) {
             primeiroItemCarrossel.querySelector('p').textContent = "Camisa não carregada.";
             primeiroItemCarrossel.querySelector('img').alt = "Camisa Padrão";
             primeiroItemCarrossel.classList.remove('selected');
        }
        checkReadyToTryOn();
    }
});
