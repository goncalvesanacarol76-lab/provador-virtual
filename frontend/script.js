document.addEventListener('DOMContentLoaded', () => {
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
  const downloadBtn = document.getElementById('downloadBtn');
  const cameraPreview = document.getElementById('cameraPreview');
  const openCameraBtn = document.getElementById('openCameraBtn');
  const captureBtn = document.getElementById('captureBtn');

  let cameraStream = null;

  async function uploadImage() {
    if (!resultsContainer) return;

    console.log("Iniciando upload para:", API_UPLOAD_ENDPOINT);
    resultsContainer.innerHTML = "";
    statusMessage.classList.remove('hidden');
    statusMessage.textContent = "Processando... Isso pode levar alguns segundos.";
    progressContainer.classList.remove('hidden');

    try {
      const formData = new FormData();
      if (selectedModelFile) formData.append('model_image', selectedModelFile);
      if (selectedGarmentFile) formData.append('garment_image', selectedGarmentFile);

      const response = await fetch(API_UPLOAD_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Erro ao processar imagem");

      console.log("Resposta do backend:", data);

      if (data.result_urls && Array.isArray(data.result_urls)) {
        statusMessage.textContent = "Sucesso! Imagens geradas:";

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
            a.download = `resultado_${index + 1}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          };

          resultsContainer.appendChild(block);
        });

        resultsContainer.classList.remove('hidden');
      } else {
        throw new Error("A IA não retornou as URLs das imagens processadas.");
      }
    } catch (error) {
      console.error("Erro na prova virtual:", error);
      statusMessage.textContent = `Falha na prova virtual: ${error.message}.`;
    } finally {
      progressContainer.classList.add('hidden');
    }
  }

  function checkReadyToTryOn() {
    tryonBtn.disabled = !(selectedGarmentFile && selectedModelFile);
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

  // Câmera
  async function startCamera() {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraPreview.srcObject = cameraStream;
      cameraPreview.classList.remove('hidden');
      captureBtn.classList.remove('hidden');
    } catch {
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

  // CARROSSEL da camisa
  const params = new URLSearchParams(window.location.search);
  const urlCamisaRecebida = params.get('camisa');
  const nomeCamisaRecebido = params.get('nome');
  const primeiroItemCarrossel = document.querySelector('#shirtCarousel .shirt-item');

  if (urlCamisaRecebida && primeiroItemCarrossel) {
    const imgElement = primeiroItemCarrossel.querySelector('img');
    const pElement = primeiroItemCarrossel.querySelector('p');

    if (imgElement) {
      imgElement.src = urlCamisaRecebida;
      imgElement.alt = nomeCamisaRecebido || "Camisa Selecionada";
    }
    if (pElement && nomeCamisaRecebido) {
      pElement.textContent = nomeCamisaRecebido;
    }

    setTimeout(() => primeiroItemCarrossel.click(), 100);
  }

  if (primeiroItemCarrossel) {
    primeiroItemCarrossel.addEventListener('click', async () => {
      primeiroItemCarrossel.classList.add('selected');
      const shirtURL = primeiroItemCarrossel.querySelector('img').src;
      if (!shirtURL) return;

      try {
        const response = await fetch(shirtURL);
        const blob = await response.blob();
        selectedGarmentFile = new File([blob], "camisa.png", { type: blob.type });
        checkReadyToTryOn();
      } catch {
        selectedGarmentFile = null;
      }
    });
  }
});
