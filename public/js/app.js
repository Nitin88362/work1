const $ = id => document.getElementById(id);
const state = { stream: null, photo: null, zoom: 1 };
const badgeAsset = new Image();
badgeAsset.src = '/assets/selfie-badge.png';
const policeLogoAsset = new Image();
policeLogoAsset.src = '/assets/uttarakhand-police.jpeg';

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

$('captureBtn').onclick = () => {
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
  ctx.fillStyle = '#07122d';
  ctx.fillRect(0, 0, 1080, 1350);

  ctx.fillStyle = '#ef1008'; ctx.fillRect(0, 0, 1080, 220);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '900 72px "Noto Sans Devanagari", sans-serif';
  ctx.fillText('मैं जागरूक हूँ', 540, 92);
  ctx.fillStyle = '#fff3d7'; ctx.font = '900 53px "Noto Sans Devanagari", sans-serif';
  ctx.fillText('साइबर क्राइम से मुक्त हूँ', 540, 170);
  ctx.fillStyle = '#f4e6c8'; ctx.beginPath(); ctx.arc(90, 108, 62, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e76818'; ctx.font = '800 25px "Noto Sans Devanagari", sans-serif'; ctx.fillText('साइबर', 90, 100);
  ctx.fillStyle = '#16344a'; ctx.font = '800 22px "Noto Sans Devanagari", sans-serif'; ctx.fillText('जागरूक', 90, 130);
  if (policeLogoAsset.complete && policeLogoAsset.naturalWidth) ctx.drawImage(policeLogoAsset, 920, 38, 125, 125);

  ctx.save(); ctx.beginPath(); ctx.rect(140, 220, 800, 760); ctx.clip();
  drawCover(ctx, raw, 140, 220, 800, 760, state.zoom);
  ctx.restore();
  ctx.strokeStyle = '#22c9f1'; ctx.lineWidth = 9; ctx.strokeRect(140, 220, 800, 760);

  ctx.fillStyle = '#081431'; ctx.fillRect(0, 980, 1080, 370);
  ctx.textAlign = 'left'; ctx.font = '800 34px "Noto Sans Devanagari", sans-serif';
  const lines = [['OTP शेयर नहीं','#ff4052'],['Unknown link पर click नहीं','#ff4052'],['अनजान video call नहीं','#ff4052'],['मदद के लिए 1930 पर कॉल','#35e56d']];
  lines.forEach((line, index) => {
    ctx.fillStyle = line[1]; ctx.fillText(index === 3 ? '☑' : '☒', 70, 1040 + index * 54);
    ctx.fillStyle = '#fff'; ctx.fillText(line[0], 118, 1040 + index * 54);
  });
  if (badgeAsset.complete && badgeAsset.naturalWidth) {
    ctx.drawImage(badgeAsset, 825, 1010, 190, 285);
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(225, 1280, 630, 52, 26); ctx.fill();
  ctx.fillStyle = '#111827'; ctx.font = '800 23px Inter, sans-serif'; ctx.fillText('AN INITIATIVE BY UTTARAKHAND POLICE', 540, 1315);
}

function posterBlob() {
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
