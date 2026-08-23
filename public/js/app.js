const $ = id => document.getElementById(id);
const state = { stream: null, photo: null, zoom: 1 };
const campaignFrameAsset = new Image();
campaignFrameAsset.src = '/assets/cyber-selfie-uttarakhand-v4.png';

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.remove('d-none');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add('d-none'), 4500);
}

function step(number) {
  document.querySelectorAll('.screen').forEach((screen, index) => screen.classList.toggle('active', index === number - 1));
  $('stepNumber').textContent = String(number).padStart(2, '0');
}

$('cameraBtn').onclick = async () => {
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false
    });
    $('video').srcObject = state.stream;
    await $('video').play();
    $('cameraEmpty').classList.add('d-none');
    $('livePill').classList.remove('d-none');
    $('cameraBtn').classList.add('d-none');
    $('captureBtn').classList.remove('d-none');
  } catch {
    toast('Camera permission allow करें। Camera localhost या HTTPS पर चलता है।');
  }
};

$('captureBtn').onclick = async () => {
  const video = $('video');
  const raw = $('rawCanvas');
  if (!video.videoWidth || !video.videoHeight) return toast('Camera तैयार होने दें, फिर selfie लें।');
  raw.width = video.videoWidth;
  raw.height = video.videoHeight;
  const ctx = raw.getContext('2d');
  ctx.save();
  ctx.translate(raw.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, raw.width, raw.height);
  ctx.restore();
  state.photo = raw.toDataURL('image/jpeg', 0.96);
  $('previewImage').src = state.photo;
  $('finalImage').src = state.photo;
  state.stream?.getTracks().forEach(track => track.stop());
  step(2);
  try {
    const response = await fetch('/api/selfies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: state.photo })
    });
    if (!response.ok) throw new Error('upload failed');
    toast('Selfie admin panel में सुरक्षित save हो गई है।');
  } catch {
    toast('Selfie server पर save नहीं हो सकी। Internet connection जाँचें।');
  }
};

$('zoomRange').oninput = event => {
  state.zoom = Number(event.target.value) / 100;
  $('previewImage').style.transform = `scale(${state.zoom})`;
  $('finalImage').style.transform = `scale(${state.zoom})`;
  $('zoomValue').textContent = event.target.value + '%';
};

$('retakeBtn').onclick = () => location.reload();
$('backBtn').onclick = () => step(2);
$('newBtn').onclick = () => location.reload();
$('continueBtn').onclick = () => {
  try {
    drawPoster();
    step(3);
  } catch {
    toast('Poster तैयार नहीं हो सका। कृपया photo दोबारा लें।');
  }
};

function drawCover(ctx, source, x, y, width, height, zoom) {
  const base = Math.min(width / source.width, height / source.height);
  const scale = base * zoom;
  const drawWidth = source.width * scale;
  const drawHeight = source.height * scale;
  ctx.fillStyle = '#030a12';
  ctx.fillRect(x, y, width, height);
  ctx.drawImage(source, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawPoster() {
  const canvas = $('posterCanvas');
  const ctx = canvas.getContext('2d');
  const raw = $('rawCanvas');
  if (!raw.width || !raw.height) throw new Error('no photo');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#030705';
  ctx.fillRect(239, 474, 602, 454);
  ctx.save(); ctx.beginPath(); ctx.rect(239, 474, 602, 454); ctx.clip();
  drawCover(ctx, raw, 239, 474, 602, 454, state.zoom);
  ctx.restore();
  if (campaignFrameAsset.complete && campaignFrameAsset.naturalWidth) ctx.drawImage(campaignFrameAsset, 0, 0, 1080, 1350);
}

async function posterBlob() {
  await campaignFrameAsset.decode();
  return new Promise((resolve, reject) => {
    drawPoster();
    $('posterCanvas').toBlob(blob => blob ? resolve(blob) : reject(new Error('blob failed')), 'image/png', 1);
  });
}

function downloadBlob(blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'cyber-jaagruti-selfie.png';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

$('downloadBtn').onclick = async () => {
  try { downloadBlob(await posterBlob()); }
  catch { toast('Download तैयार नहीं हो सका। कृपया photo दोबारा लें।'); }
};

$('shareBtn').onclick = async () => {
  try {
    const blob = await posterBlob();
    const file = new File([blob], 'cyber-jaagruti-selfie.png', { type: 'image/png' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: 'Cyber Jaagruti Abhiyaan', text: 'मैं cyber crime के प्रति जागरूक हूँ।', files: [file] });
      return;
    }
    if (navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('Image clipboard में copy हो गई है—अब WhatsApp या social app में paste करें।');
      return;
    }
    downloadBlob(blob);
    toast('इस browser में direct share उपलब्ध नहीं है। Image download कर दी गई है।');
  } catch (error) {
    if (error?.name !== 'AbortError') toast('Share नहीं हो सका। Download button का उपयोग करें।');
  }
};
