
document.addEventListener("DOMContentLoaded", () => {
  let dark = true;
let particleColor = "rgba(0,255,255,.5)";
let lineColor = "rgba(255,100,255,";


const products = {};
const productsDiv = document.getElementById("products");
const historyTableBody = document.getElementById("historyTable");
const sseStatus = document.getElementById("sseStatus");

function formatToman(n){ return n.toLocaleString("fa-IR"); }

function createCard(p){
  const card=document.createElement("div");
  card.className="card-glow p-6 rounded-2xl flex flex-col justify-between";

  // اضافه کردن لینک به دیجی‌کالا
  card.innerHTML=`
    <a href="https://www.digikala.com/product/${p.id}/" target="_blank" class="block">
      <div class="font-bold text-lg mb-2 neon">${p.title}</div>
      <div class="text-gray-400 mb-3 text-sm">${p.id}</div>
      <div class="flex items-end mb-4">
        <span class="price text-2xl font-extrabold text-indigo-300">${formatToman(p.price)}</span>
        <span class="text-gray-400 mr-2 mb-1">تومان</span>
      </div>
      <canvas id="chart-${p.id}" class="w-full h-32"></canvas>
    </a>
  `;

  products[p.id]={...p,el:card,chart:null};
  productsDiv.appendChild(card);
}


function updateProduct(id,title,newPrice,oldPrice){
  let p=products[id];
  if(!p){
    p={id,title,price:newPrice};
    createCard(p);
  }else{
    const priceEl=p.el.querySelector(".price");
    priceEl.textContent=formatToman(newPrice);
    priceEl.classList.remove("text-green-400","text-pink-400","price-flash");
    if(newPrice>p.price) priceEl.classList.add("text-green-400","price-flash");
    else if(newPrice<p.price) priceEl.classList.add("text-pink-400","price-flash");
    p.price=newPrice;
  }

  // جدول تاریخچه
  const diff=newPrice-(oldPrice??newPrice);
  const ts=new Date().toLocaleTimeString("fa-IR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const diffClass=diff<0?"text-pink-400":"text-green-400";
  const diffText=diff===0?'-':(diff<0?"↓ ":"↑ ")+Math.abs(diff).toLocaleString("fa-IR");
  const tr=document.createElement("tr");
  tr.innerHTML=`<td class="py-3 px-6">${ts}</td>
  <td class="py-3 px-6 ${diffClass} font-semibold">${title}</td>
  <td class="py-3 px-6 text-gray-400">${oldPrice?formatToman(oldPrice):'-'}</td>
  <td class="py-3 px-6">${formatToman(newPrice)}</td>
  <td class="py-3 px-6 ${diffClass} font-bold">${diffText}</td>`;
  historyTableBody.prepend(tr);

  // ✨ اضافه کردن افکت درخشش به ردیف جدید
    tr.classList.add("new-row");
    setTimeout(() => tr.classList.remove("new-row"), 1500);

  // نمودار
  const now=new Date().toLocaleTimeString("fa-IR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const chart=p.chart;
  chart.data.labels.push(now);
  chart.data.datasets[0].data.push(newPrice);
  if(chart.data.labels.length>20){chart.data.labels.shift();chart.data.datasets[0].data.shift();}
  chart.update();
}

// اتصال به SSE سرور
const evtSource=new EventSource("/events");
evtSource.addEventListener("open",()=>{
  sseStatus.textContent="متصل";
  sseStatus.className="font-semibold px-3 py-1 rounded-lg bg-green-500";
});
evtSource.addEventListener("error",()=>{
  sseStatus.textContent="قطع";
  sseStatus.className="font-semibold px-3 py-1 rounded-lg bg-red-600";
});
evtSource.addEventListener("price",e=>{
  try{
    const d=JSON.parse(e.data);
    updateProduct(d.productId,d.title,d.newPrice,d.oldPrice);
  }catch(err){console.warn(err);}
});

// دکمه‌ها
document.getElementById("requestPerm").addEventListener("click",()=>Notification.requestPermission());
document.getElementById("clearHistory").addEventListener("click",()=>historyTableBody.innerHTML="");
// افزودن محصول جدید
document.getElementById("addProduct").addEventListener("click", async () => {
  const urlInput = document.getElementById("newUrl");
  const url = urlInput.value.trim();

  if (!url || !url.startsWith("https://www.digikala.com/product/")) {
    alert("لطفاً لینک معتبر دیجی‌کالا وارد کنید!");
    return;
  }

  try {
    const res = await fetch("/add-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (res.ok) {
      alert("✅ محصول با موفقیت اضافه شد و به لیست ترکینگ افزوده گردید.");
      urlInput.value = "";
    } else {
      alert("⚠️ خطا در افزودن محصول به سرور");
    }
  } catch (err) {
    alert("❌ اتصال به سرور برقرار نشد!");
    console.error(err);
  }
});

// افکت تغییر تم
// 🎨 حالت تیره/روشن

document.getElementById("toggleTheme").addEventListener("click", () => {
  dark = !dark;
  const body = document.body;
  const btn = document.getElementById("toggleTheme");
  
  if(dark) {
    document.body.style.background = "#0a0a0f";
    document.body.style.color = "#fff";
    canvas.style.background = "#0a0a0f";
    particleColor = "rgba(0,255,255,0.6)";
    lineColor = "rgba(160,90,255,";
    document.getElementById("toggleTheme").textContent = "🌙 حالت تاریک";
  } else {
    document.body.style.background = "linear-gradient(to right, #e0e7ff, #fff)";
    document.body.style.color = "#111";
    canvas.style.background = "#dbeafe";
    particleColor = "rgba(0,0,255,0.4)";
    lineColor = "rgba(160,90,255,";
    document.getElementById("toggleTheme").textContent = "☀️ حالت روشن";
  }

  // ✨ تغییر رنگ پارتیکل‌ها در حالت روشن
  // particleColor = dark ? "rgba(0,255,255,0.6)" : "rgba(0,0,255,0.4)";
  // lineColor = dark ? "rgba(255,0,255," : "rgba(0,0,255,";
});


// ذرات نئون
const canvas = document.getElementById("particle-canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particles = [];
const numParticles = 400;
const maxDistance = 120;
const mouse = { x: null, y: null };

for (let i = 0; i < numParticles; i++) {
  particles.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: Math.random() * 2 + 1,
    vx: (Math.random() - 0.5) * 0.8,
    vy: (Math.random() - 0.5) * 0.8,
  });
}

window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

function drawParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles.forEach((p, i) => {
    // حرکت پارتیکل‌ها
    p.x += p.vx;
    p.y += p.vy;

    if (p.x < 0 || p.x > canvas.width) p.vx = -p.vx + (Math.random()-0.5)*0.2;
    if (p.y < 0 || p.y > canvas.height) p.vy = -p.vy + (Math.random()-0.5)*0.2;


    // فاصله تا ماوس
    const dx = p.x - mouse.x;
    const dy = p.y - mouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 200) {
      p.x += dx / dist * 0.25;
      p.y += dy / dist * 0.25;
    }

    // رسم پارتیکل
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = particleColor; 
    ctx.fill();
    

    // رسم خطوط نئون بین پارتیکل‌های نزدیک
    for (let j = i + 1; j < particles.length; j++) {
      const p2 = particles[j];
      const dx2 = p.x - p2.x;
      const dy2 = p.y - p2.y;
      const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (dist2 < maxDistance) {
        const alpha = 1 - dist2 / maxDistance;
        ctx.strokeStyle = `${lineColor}${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  });

  requestAnimationFrame(drawParticles);
}

drawParticles();


// Testing mode functionality
let testMode = false;

document.getElementById("toggleTestMode").addEventListener("click", async () => {
  testMode = !testMode;
  const btn = document.getElementById("toggleTestMode");
  btn.textContent = testMode ? "🧪 حالت تست: روشن" : "🧪 حالت تست: خاموش";
  btn.classList.toggle("bg-purple-700", testMode);
  btn.classList.toggle("bg-purple-600", !testMode);

  try {
    await fetch("/set-test-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: testMode }),
    });
    console.log(`✅ Test Mode set to: ${testMode}`);
  } catch (err) {
    console.warn("⚠️ Error updating test mode:", err);
  }
});



});


