const API_BASE_URL = 'https://provador-virtual-backend.onrender.com';
const API_UPLOAD_ENDPOINT = API_BASE_URL + '/api/upload';

let selectedGarmentFile = null;
let selectedModelFile = null;

async function uploadImage() {
  console.log("Iniciando processo de upload para:", API_UPLOAD_ENDPOINT);

  const progressContainer = document.getElementById('progress-container');
  const statusMessage = document.getElementById('status-message');
  const resultDiv = document.getElementById('result');
  const downloadBtn = document.getElementById('downloadBtn');

  // Elemento onde irão aparecer os 4 blocos
  const resultsContainer = document.getElementById('resultsContainer');

  resultsContainer.innerHTML = ""; // limpa tudo
  resultDiv.classList.add('hidden');
  downloadBtn.classList.add('hidden');

  statusMessage.textContent = "Processando... Isso pode levar alguns segundos.";
  statusMessage.classList.remove('hidden');
  progressContainer.classList.remove('hidden');

  try {
    const formData = new FormData();

    if (selectedModelFile) formData.append('model_image', selectedModelFile);
    if (selectedGarmentFile) formData.append('garment_image', selectedGarmentFile);

    const response = await fetch(API_UPLOAD_ENDPOINT, {
      method: 'POST',
      body: formData,
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("Resposta inválida do servidor (não é JSON).");
    }

    if (!response.ok) {
      console.error("Erro da API:", data);
      throw new Error(data.error || "Erro ao processar imagem");
    }

    console.log("Resposta do backend:", data);

    // Agora esperamos um array chamado result_urls (4 imagens)
    if (data.result_urls && Array.isArray(data.result_urls)) {
      statusMessage.textContent = "Sucesso! Imagens geradas:";

      // Criar 4 blocos para as imagens
      data.result_urls.forEach((imgURL, index) => {
        const block = document.createElement("div");
        block.className = "result-block";

        block.innerHTML = `
          <h3>Resultado ${index + 1}</h3>
          <img src="${imgURL}" class="result-image">
          <button class="downloadSingle">Baixar</button>
        `;

        // botão de download individual
        block.querySelector(".downloadSingle").onclick = () => {
          const a = document.createElement('a');
          a.href = imgURL;
          a.download = `resultado_${index + 1}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        };

        resultsContainer.appendChild(block);
      });

      resultDiv.classList.remove('hidden');
    } else {
      throw new Error("A IA não retornou as URLs das imagens processadas.");
    }
  } catch (error) {
    console.error("Erro ao tentar a prova virtual:", error);
    statusMessage.textContent = `Falha na prova virtual: ${error.message}.`;
  } finally {
    progressContainer.classList.add('hidden');
  }
}


document.addEventListener('DOMContentLoaded', () => {

  const params = new URLSearchParams(window.location.search);
  const urlCamisaRecebida = params.get('camisa');
  const nomeCamisaRecebido = params.get('nome');

  const primeiroItemCarrossel = document.querySelector('#shirtCarousel .shirt-item');

  if (urlCamisaRecebida && primeiroItemCarrossel) {
    console.log("Camisa recebida da página de produto:", urlCamisaRecebida);
    
    const imgElement = primeiroItemCarrossel.querySelector('img');
    const pElement = primeiroItemCarrossel.querySelector('p');

    if (imgElement) {
      imgElement.src = urlCamisaRecebida;
      imgElement.alt = nomeCamisaRecebido || "Camisa Selecionada";
    }
    if (pElement && nomeCamisaRecebido) {
      pElement.textContent = nomeCamisaRecebido;
    }

    setTimeout(() => {
      primeiroItemCarrossel.click(); 
    }, 100); 
  }

  if (primeiroItemCarrossel) {
    primeiroItemCarrossel.addEventListener('click', async () => {
      primeiroItemCarrossel.classList.add('selected');

      const shirtURL = primeiroItemCarrossel.querySelector('img').src;
      if (!shirtURL) return; 

      try {
        console.log("A carregar imagem da camisa...");
        const response = await fetch(shirtURL);
        const blob = await response.blob();
        
        selectedGarmentFile = new File([blob], "camisa.png", { type: blob.type });
        checkReadyToTryOn();
      
      } catch (error) {
        console.error("Erro ao carregar a imagem da camisa:", error);
        selectedGarmentFile = null;
      }
    });
  }

  // Upload pessoa
  const personInput = document.getElementById('personInput');
  const personPreview = document.getElementById('personPreview');

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

  // Câmera
  const openCameraBtn = document.getElementById('openCameraBtn');
  const captureBtn = document.getElementById('captureBtn');
  const cameraPreview = document.getElementById('cameraPreview');
  let cameraStream = null;

  async function startCamera() {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraPreview.srcObject = cameraStream;
      cameraPreview.classList.remove('hidden');
      captureBtn.classList.remove('hidden');
    } catch (err) {
      alert("Não foi possível acessar a câmera.");
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
    const video = cameraPreview;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      selectedModelFile = new File([blob], 'foto-camera.png', { type: 'image/png' });
      const imageUrl = URL.createObjectURL(blob);
      personPreview.src = imageUrl;
      personPreview.classList.remove('hidden');
      stopCameraIfRunning();
      checkReadyToTryOn();
    }, 'image/png');
  });

  // botão "Testar roupa"
  const tryonBtn = document.getElementById('tryonBtn');

  function checkReadyToTryOn() {
    const hasShirt = !!selectedGarmentFile; 
    const hasModel = !!selectedModelFile;
    tryonBtn.disabled = !(hasShirt && hasModel);
  }

  tryonBtn.addEventListener('click', () => {
    if (!tryonBtn.disabled) uploadImage();
  });

});
