const fhContainer = document.getElementById('floating-hearts');
const symbols = ['💗','💕','💩','🐾','💓','🌸','💝'];
function spawnHeart() {
  const h = document.createElement('span');
  h.className = 'fheart';
  h.textContent = symbols[Math.floor(Math.random() * symbols.length)];
  h.style.left = Math.random() * 100 + 'vw';
  const dur = 6 + Math.random() * 8;
  h.style.animationDuration = dur + 's';
  h.style.fontSize = (16 + Math.random() * 20) + 'px';
  h.style.animationDelay = (Math.random() * 4) + 's';
  fhContainer.appendChild(h);
  setTimeout(() => h.remove(), (dur + 4) * 1000);
}
for (let i = 0; i < 14; i++) setTimeout(spawnHeart, i * 600);
setInterval(spawnHeart, 1800);

const nameInput = document.getElementById('name-input');
const faceEl    = document.querySelector('.face-emoji');

nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') startLetter();
});
document.getElementById('submit-btn').addEventListener('click', startLetter);
document.getElementById('return-btn').addEventListener('click', () => {
  document.getElementById('letter-screen').classList.add('hidden');
  document.getElementById('name-screen').classList.remove('hidden');
});



const canvas = document.getElementById('thread-canvas');
const ctx = canvas.getContext('2d');
let threadPoints = [];

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = document.body.scrollHeight;
}
window.addEventListener('resize', () => { resizeCanvas(); drawThread(); });

function drawThread() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (threadPoints.length < 2) return;
  ctx.strokeStyle = 'rgba(232,96,138,0.22)';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(threadPoints[0].x, threadPoints[0].y);
  for (let i = 1; i < threadPoints.length; i++) {
    const p = threadPoints[i];
    const pp = threadPoints[i - 1];
    const cpx = (pp.x + p.x) / 2;
    const cpy = (pp.y + p.y) / 2;
    ctx.quadraticCurveTo(pp.x, pp.y, cpx, cpy);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  for (const pt of threadPoints) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(232,96,138,0.35)';
    ctx.fill();
  }
}

function addThreadPoint(el) {
  const r = el.getBoundingClientRect();
  const scrollY = window.scrollY || window.pageYOffset;
  const x = r.left + r.width / 2;
  const y = r.top + scrollY + r.height / 2;
  threadPoints.push({
    x: x + (Math.random() - 0.5) * 30,
    y: y + (Math.random() - 0.5) * 6
  });
  resizeCanvas();
  drawThread();
}

function getLines(name) {
  return [
    { type: '', text: `Hoyyyy... , ${name}...` },
    { text: `Hiiiiiiiii since alam mo na meron ako gusto sayo edi wow...,` },
    { text: ` sa totoo lang, tinatanong ko nung una sarili ko, ano ba nakita ko dito sa taong to, diko din ma explain nung una but i found my self again na nakikipag usap sa babae which is i don't do that, ganto kasi yan HAHAHAHA.` },
    { text: ` OA person ka eh. don mo ako nadale AHGWAHGHAHAHAAHA. (´。• ᵕ •。\`)` },
    { spacer: true },
    { text: `tas yung energy mo its giving something to me din talaga HWADHAGJGAHAHAHAH` },
    { text: `di ako stalker ha pero inistalk kita sa socials mo, cute ka naman e pero di moko madadali don boi BHAWAHDGAHAHHAAHAH. pero kasi anlalo sa pagiging cute mo sa boses mo e, boses nanay ka kasi HAHAHAHAHAHAHAHAHAHAHAHAHAHAHAHAHAHA` },
    { spacer: true },
    { center: true, text: `EDI WOW` },
    { spacer: true },
    { text: `basta di lang naman yan yung nagustohan ko sayo e, madami kaya... pero still im looking forward parin sayo, gusto pa rin kita makilala ng husto, hindi lang sapat sakin yung naririnig ka, naririnig ko sayo ngayon o yung nakikita ko sayo ngayon. interesado ako malaman at gusto kong maintindihan kung sino ka talaga, lahat ng bagay kahit ano man yan basta tungkol sa buhay mo...` },
    { sign: true, text: `I LAV BISAYA <img src="https://scontent.fmnl8-1.fna.fbcdn.net/v/t1.15752-9/742110577_2237710513708593_1010755707364317114_n.jpg?stp=dst-jpg_s480x480_tt6&_nc_cat=101&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=0024fc&_nc_eui2=AeExJmnQOOe_2CFauU6tF9ThWfzlxTDUWy5Z_OXFMNRbLn9c4zDS-PfCGjweH10iur_TyrFLQWhCdXUKWDUItC5K&_nc_ohc=BnlNokZNRUsQ7kNvwH8Hvg4&_nc_oc=AdouJmh0oufEIr3rkucwU6OeuaMYXH6sT5R-yOWQNzYjT2avuN8gsUMcjXnbfamY7Wo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent.fmnl8-1.fna&_nc_ss=7a22e&oh=03_Q7cD6AHCYfuzk6I3_d-W3cgopuV5-jX0ytT8VBfh1tldS-A3hg&oe=6A912F49" alt="Heart" width="60" height="60">` }
  ];
}

async function typeLine(el, text, speed = 28) {
  el.innerHTML = '';
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  el.appendChild(cursor);

  for (let i = 0; i < text.length; ) {
    if (text[i] === '<') {
      const end = text.indexOf('>', i);
      if (end !== -1) {
        const tagHtml = text.slice(i, end + 1);
        cursor.insertAdjacentHTML('beforebegin', tagHtml);
        i = end + 1;
        await sleep(Math.max(30, Math.floor(speed * 0.6)));
        continue;
      }
    }
    const ch = text[i];
    cursor.insertAdjacentText('beforebegin', ch);
    await sleep(ch === ' ' ? speed * 0.4 : speed + (Math.random() * 14 - 7));
    i++;
  }
  cursor.remove();
  addThreadPoint(el);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function startLetter() {
  const rawName = nameInput.value.trim();
  const normalized = rawName.toLowerCase();
  const isAllowedName = normalized === 'gwyneth';

  document.getElementById('name-screen').classList.add('hidden');
  const ls = document.getElementById('letter-screen');
  ls.classList.remove('hidden');

  resizeCanvas();
  threadPoints = [];

  const greetEl = document.getElementById('greeting');
  const container = document.getElementById('lines-container');
  greetEl.textContent = '';
  container.innerHTML = '';

  await sleep(400);

  
  const returnBtn = document.getElementById('return-btn');
  if (!rawName || !isAllowedName) {
    returnBtn.classList.remove('hidden');
    await typeLine(greetEl, `Hoy...`, 38);
    await sleep(800);
    await typeLine(greetEl, `alam ko name mo...`, 38);
    await sleep(800);
    await typeLine(greetEl, `ilagay mo first name mo para maangas HAHAHAHAHA`, 38);
    await sleep(800);
    return;
  }
  returnBtn.classList.add('hidden');

  const name = rawName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  await typeLine(greetEl, `Hilu, ${name}...`, 38);
  await sleep(200);

  const lines = getLines(name);
  const rest = lines.slice(1);

  for (const item of rest) {
    if (item.spacer) { await sleep(80); continue; }

    const div = document.createElement('div');
    div.className = 'line';
    if (item.center) div.classList.add('center');
    if (item.sign)   div.classList.add('sign');
    if (item.spacer) div.classList.add('spacer');
    container.appendChild(div);

    div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const speed = item.center ? 40 : item.sign ? 35 : 22;
    await typeLine(div, item.text, speed);

    if (item.center) await sleep(600);
    else await sleep(120);

   
    resizeCanvas();
    drawThread();
  }
}