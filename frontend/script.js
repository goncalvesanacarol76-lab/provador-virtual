// =========================
// CONFIG GERAL DA API
// =========================
const API_BASE_URL = 'https://provador-virtual-backend.onrender.com';
const API_UPLOAD_ENDPOINT = API_BASE_URL + '/api/upload';

let selectedGarmentFile = null; // (opcional, hoje o backend usa fallback)
let selectedModelFile = null;   // foto da pessoa (upload ou câmera)


// =========================
// FUNÇÃO PRINCIPAL: CHAMAR BACKEND / REPLICATE
// =========================
async function uploadImage() {
  console.log("Iniciando processo de upload para:", API_UPLOAD_ENDPOINT);

  const progressContainer = document.getElementById('progress-container');
  const statusMessage    = document.getElementById('status-message');
  const resultDiv        = document.getElementById('result');
  const resultImg        = document.getElementById('resultImg');
  const downloadBtn      = document.getElementById('downloadBtn');

  // limpar estado anterior
  resultImg.src = '';
  downloadBtn.classList.add('hidden');
  resultDiv.classList.add('hidden');

  statusMessage.textContent = "Processando... Isso pode levar uns 30 segundos. Aguarde!";
  statusMessage.classList.remove('hidden');
  progressContainer.classList.remove('hidden');

  try {
    const formData = new FormData();

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
      let errorData = {};
      try {
        errorData = await response.json();
      } catch (_) {}

      console.error("Erro da API:", errorData);
      throw new Error(errorData.error || response.statusText);
    }

    const data = await response.json();
    console.log("Resposta do backend:", data);

    if (data.result_url) {
      statusMessage.textContent = "Sucesso! Imagem gerada pela IA:";
      resultImg.src = data.result_url;
      resultDiv.classList.remove('hidden');

      downloadBtn.classList.remove('hidden');
      downloadBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = data.result_url;
        a.download = 'provador-virtual.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
    } else {
      throw new Error("A IA não retornou a URL da imagem processada.");
    }

  } catch (error) {
    console.error("Erro ao tentar a prova virtual:", error);
    statusMessage.textContent =
      `Falha na prova virtual: ${error.message}. Veja o console para mais detalhes.`;
    alert("Ops! Não foi possível gerar a imagem. Veja o console do navegador.");

  } finally {
    progressContainer.classList.add('hidden');
  }
}


// =========================
// LÓGICA DE UI / CÂMERA / CARROSSEL
// =========================
document.addEventListener('DOMContentLoaded', () => {
  // ---------- Carrossel de camisas ----------
  const carousel    = document.getElementById('shirtCarousel');
  const shirtItems  = document.querySelectorAll('.shirt-item');
  const prevBtn     = document.getElementById('prevBtn');
  const nextBtn     = document.getElementById('nextBtn');

  let currentIndex = 0;

  function scrollToIndex(index) {
    const item = shirtItems[index];
    if (!item) return;
    const offsetLeft = item.offsetLeft;
    carousel.scrollTo({ left: offsetLeft - 20, behavior: 'smooth' });
  }

  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
      currentIndex--;
      scrollToIndex(currentIndex);
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentIndex < shirtItems.length - 1) {
      currentIndex++;
      scrollToIndex(currentIndex);
    }
  });

  // Selecionar camisa
  shirtItems.forEach((item, idx) => {
    item.addEventListener('click', async () => {
      shirtItems.forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      currentIndex = idx;

      // (Opcional) se quiser transformar a imagem local em File para mandar pro backend:
      // por enquanto não é obrigatório, pois o backend está usando imagem fixa
      // então só vamos guardar que tem uma camisa selecionada
      selectedGarmentFile = true; // apenas marca que tem camisa
      checkReadyToTryOn();
    });
  });

  // ---------- Upload de foto ----------
  const personInput    = document.getElementById('personInput');
  const personPreview  = document.getElementById('personPreview');

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

  // ---------- Câmera ----------
  const openCameraBtn = document.getElementById('openCameraBtn');
  const captureBtn    = document.getElementById('captureBtn');
  const cameraPreview = document.getElementById('cameraPreview');

  let cameraStream = null;

  async function startCamera() {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraPreview.srcObject = cameraStream;
      cameraPreview.classList.remove('hidden');
      captureBtn.classList.remove('hidden');
    } catch (err) {
      console.error("Erro ao acessar câmera:", err);
      alert("Não foi possível acessar a câmera. Verifique permissões do navegador.");
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

  openCameraBtn.addEventListener('click', () => {
    startCamera();
  });

  captureBtn.addEventListener('click', () => {
    if (!cameraStream) return;

    const video  = cameraPreview;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
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

  // ---------- Botão "Testar roupa" ----------
  const tryonBtn = document.getElementById('tryonBtn');

  function checkReadyToTryOn() {
    const hasShirt = document.querySelector('.shirt-item.selected') !== null;
    const hasModel = !!selectedModelFile;
    tryonBtn.disabled = !(hasShirt && hasModel);
  }

  tryonBtn.addEventListener('click', () => {
    if (!tryonBtn.disabled) {
      uploadImage();
    }
  });
});
