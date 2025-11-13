const personInput = document.getElementById("personInput");
const tryonBtn = document.getElementById("tryonBtn");
const result = document.getElementById("result");
const resultImg = document.getElementById("resultImg");
const progressContainer = document.getElementById("progress-container");
const progressBar = document.querySelector(".progress-bar");
const downloadBtn = document.getElementById("downloadBtn");
const openCameraBtn = document.getElementById("openCameraBtn");
const cameraPreview = document.getElementById("cameraPreview");
const captureBtn = document.getElementById("captureBtn");

let personId = null;
let clothId = null;
let finalUrl = "";
let progressInterval = null;
let stream = null;

async function uploadImage(file, type) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

const res = await fetch("https://provador-virtual-h719.onrender.com/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  return data.id;
}

openCameraBtn.onclick = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraPreview.srcObject = stream;
    cameraPreview.classList.remove("hidden");
    captureBtn.classList.remove("hidden");
  } catch (err) {
    alert("Não foi possível acessar a câmera.");
  }
};

captureBtn.onclick = async () => {
  const canvas = document.createElement("canvas");
  canvas.width = cameraPreview.videoWidth;
  canvas.height = cameraPreview.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(cameraPreview, 0, 0);

  canvas.toBlob(async (blob) => {
    const file = new File([blob], "foto.jpg", { type: "image/jpeg" });
    personId = await uploadImage(file, "person");
    stopCamera();
    checkReady();
  }, "image/jpeg");
};

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  cameraPreview.classList.add("hidden");
  captureBtn.classList.add("hidden");
}

personInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (file) {
    personId = await uploadImage(file, "person");
    checkReady();
  }
});

const shirts = document.querySelectorAll(".shirt-item");
shirts.forEach((item) => {
  item.addEventListener("click", async () => {
    shirts.forEach((s) => s.classList.remove("selected"));
    item.classList.add("selected");

    const imageUrl = item.dataset.src; 
    if (!imageUrl) {
      alert("Imagem da camisa não encontrada!");
      return;
    }

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], "camisa.png", { type: blob.type });
      clothId = await uploadImage(file, "cloth");
      checkReady();
    } catch (error) {
      console.error("Erro ao carregar a imagem da camisa:", error);
      alert("Não foi possível carregar a camisa selecionada.");
    }
  });
});

function checkReady() {
  tryonBtn.disabled = !(personId && clothId);
}

function simulateProgress() {
  let width = 0;
  if (progressInterval) clearInterval(progressInterval);
  progressInterval = setInterval(() => {
    if (width >= 95) return;
    width += Math.random() * 5;
    if (width > 95) width = 95;
    progressBar.style.width = width + "%";
  }, 700);
}

function cleanupProgress() {
  if (progressInterval) clearInterval(progressInterval);
  progressBar.style.width = "100%";
  progressContainer.classList.add("hidden");
}

tryonBtn.addEventListener("click", async () => {
  result.classList.add("hidden");
  progressContainer.classList.remove("hidden");
  progressBar.style.width = "0%";
  simulateProgress();

  try {
    const initRes = await fetch("https://provador-virtual-h719.onrender.com/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        person_id: personId,
        cloth_id: clothId,
      }),
    });

    const task = await initRes.json();

    if (!task.task_id) {
      alert("Erro ao iniciar a geração.");
      cleanupProgress();
      return;
    }

    let status = task.status;
    finalUrl = task.result_url || "";

    while (status === "PROCESSING" || !finalUrl) {
      await new Promise((r) => setTimeout(r, 4000));

      const checkRes = await fetch("https://provador-virtual-h719.onrender.com/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task.task_id }),
      });

      const checkData = await checkRes.json();
      status = checkData.status;
      finalUrl = checkData.result_url || "";

      if (status === "FAILED") {
        alert("Erro: falha na geração da imagem.");
        cleanupProgress();
        return;
      }
    }

    cleanupProgress();
    resultImg.src = finalUrl;
    result.classList.remove("hidden");
    downloadBtn.classList.remove("hidden");

    downloadBtn.onclick = async () => {
      try {
        const response = await fetch(finalUrl);
        const blob = await response.blob();

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "provador-virtual.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Erro ao salvar imagem:", err);
        alert("Não foi possível salvar a imagem.");
      }
    };
  } catch (error) {
    console.error("Erro geral:", error);
    alert("Erro de conexão com o servidor.");
    cleanupProgress();
  }
});
