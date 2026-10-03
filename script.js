/* =========================================================
   FBC MANAGEMENT v3
   COMPLETE APP SCRIPT
   ========================================================= */

const KEY = FBC_CONFIG.storageKey;

const defaultPlans = [
  {id: uid(), name: "Monthly", price: 1000, duration: 30},
  {id: uid(), name: "Quarterly", price: 2500, duration: 90},
  {id: uid(), name: "Yearly", price: 8000, duration: 365}
];

const blank = {
  members: [],
  attendance: [],
  payments: [],
  workouts: [],
  diet: [],
  trainers: [],
  plans: defaultPlans,
  history: []
};

let db = load();

/* ================= HELPERS ================= */

function uid(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

function clone(obj){
  return JSON.parse(JSON.stringify(obj));
}

function load(){
  try{
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if(!saved) return clone(blank);

    return {
      members: Array.isArray(saved.members) ? saved.members : [],
      attendance: Array.isArray(saved.attendance) ? saved.attendance : [],
      payments: Array.isArray(saved.payments) ? saved.payments : [],
      workouts: Array.isArray(saved.workouts) ? saved.workouts : [],
      diet: Array.isArray(saved.diet) ? saved.diet : [],
      trainers: Array.isArray(saved.trainers) ? saved.trainers : [],
      plans: Array.isArray(saved.plans) && saved.plans.length ? saved.plans : clone(defaultPlans),
      history: Array.isArray(saved.history) ? saved.history : []
    };
  }catch(e){
    console.error(e);
    return clone(blank);
  }
}

function save(){
  localStorage.setItem(KEY, JSON.stringify(db));
  renderAll();
}

function esc(value=""){
  return String(value).replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[m]));
}

function today(){
  return new Date().toISOString().slice(0,10);
}

function money(value){
  return "₹" + Number(value || 0).toLocaleString("en-IN");
}

function member(id){
  return db.members.find(x => x.id === id);
}

function daysLeft(date){
  if(!date) return 0;
  const end = new Date(date + "T23:59:59");
  return Math.ceil((end - new Date()) / 86400000);
}

function memberPayments(id){
  return db.payments.filter(p => p.memberId === id);
}

function paidAmount(id){
  return memberPayments(id).reduce((sum,p) => sum + Number(p.amount || 0), 0);
}

function selectedPlan(m){
  return db.plans.find(p => p.name === m.plan) || null;
}

function membershipTotal(m){
  const plan = selectedPlan(m);
  return Number(m.membershipFee ?? plan?.price ?? 0);
}

function dueAmount(m){
  return Math.max(0, membershipTotal(m) - paidAmount(m.id));
}

function paymentStatus(m){
  const due = dueAmount(m);
  if(due <= 0) return "PAID";
  if(paidAmount(m.id) > 0) return "PARTIAL";
  return "PENDING";
}

function isActive(m){
  return !!m && !!m.expiry && m.expiry >= today();
}

function alertType(m){
  const d = daysLeft(m.expiry);
  if(d < 0) return "red";
  if(d <= 5) return "yellow";
  return "";
}

function toast(message){
  const box = document.getElementById("toast");
  if(!box) return;
  box.textContent = message;
  box.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => box.classList.remove("show"), 2300);
}

/* ================= ACTIVITY HISTORY ================= */
function logHistory(type, title, detail="", icon="📝") {
  if(!Array.isArray(db.history)) db.history = [];
  db.history.unshift({
    id: uid(),
    type,
    title,
    detail,
    icon,
    time: new Date().toISOString()
  });
  db.history = db.history.slice(0, 500);
}

function historyTime(value){
  try{ return new Date(value).toLocaleString("en-IN", {dateStyle:"medium", timeStyle:"short"}); }
  catch(e){ return value || ""; }
}

function renderHistory(){
  const box = document.getElementById("historyList");
  if(!box) return;
  const search = (document.getElementById("historySearch")?.value || "").toLowerCase();
  const filter = document.getElementById("historyFilter")?.value || "all";
  const list = (db.history || []).filter(h => {
    if(filter !== "all" && h.type !== filter) return false;
    const text = [h.title,h.detail,h.type].join(" ").toLowerCase();
    return !search || text.includes(search);
  });
  box.innerHTML = list.map(h => `
    <div class="historyItem">
      <div class="historyIcon">${h.icon || "📝"}</div>
      <div class="historyContent">
        <b>${esc(h.title)}</b>
        <p>${esc(h.detail || "")}</p>
        <small>${historyTime(h.time)}</small>
      </div>
    </div>
  `).join("") || `<div class="historyEmpty">No activity found.</div>`;
}

document.getElementById("historySearch")?.addEventListener("input", renderHistory);
document.getElementById("historyFilter")?.addEventListener("change", renderHistory);
document.getElementById("clearHistoryBtn")?.addEventListener("click", () => {
  if(!(db.history || []).length){ toast("History is already empty"); return; }
  if(confirm("Clear all activity history?")){
    db.history = [];
    save();
    toast("History cleared");
  }
});

/* ================= NAVIGATION ================= */

function openPage(id){
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");

  document.querySelectorAll(".nav").forEach(n => {
    n.classList.toggle("active", n.dataset.page === id);
  });

  window.scrollTo({top:0, behavior:"smooth"});
  renderAll();
}

document.querySelectorAll(".nav").forEach(btn => {
  btn.addEventListener("click", () => openPage(btn.dataset.page));
});

document.querySelectorAll("[data-go]").forEach(btn => {
  btn.addEventListener("click", () => openPage(btn.dataset.go));
});

document.getElementById("menuBtn")?.addEventListener("click", () => {
  toast("Mobile navigation is at the bottom");
});

document.getElementById("themeBtn")?.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(
    "fbc_dark",
    document.body.classList.contains("dark") ? "true" : "false"
  );
});

if(localStorage.getItem("fbc_dark") === "true"){
  document.body.classList.add("dark");
}

/* ================= NETWORK ================= */

function updateNetwork(){
  const el = document.getElementById("networkStatus");
  if(!el) return;

  if(navigator.onLine){
    el.textContent = "● ONLINE";
    el.className = "status online";
  }else{
    el.textContent = "● OFFLINE";
    el.className = "status offline";
  }
}

window.addEventListener("online", updateNetwork);
window.addEventListener("offline", updateNetwork);
updateNetwork();

/* ================= MODAL ================= */

function modal(title, html, onSubmit){
  const modalBox = document.getElementById("modal");
  const form = document.getElementById("modalForm");

  document.getElementById("modalTitle").textContent = title;
  form.innerHTML = html;

  form.onsubmit = async e => {
    e.preventDefault();
    try{
      await onSubmit(new FormData(form));
      closeModal();
    }catch(error){
      console.error(error);
      toast("Something went wrong");
    }
  };

  modalBox.classList.add("show");

  setTimeout(() => {
    const plan = document.getElementById("memberPlan");
    const joining = document.querySelector('#modalForm input[name="joining"]');

    if(plan){
      plan.onchange = updateMemberPlanFields;
      if(joining) joining.onchange = updateMemberPlanFields;
      updateMemberPlanFields();
    }
  }, 0);
}

function closeModal(){
  document.getElementById("modal").classList.remove("show");
}

document.getElementById("closeModal").onclick = closeModal;

document.getElementById("modal").addEventListener("click", e => {
  if(e.target.id === "modal") closeModal();
});

/* ================= PAYMENT ================= */

function paymentForm(memberId="", suggest=0){
  const options = db.members.map(m => `
    <option value="${m.id}" ${m.id === memberId ? "selected" : ""}>
      ${esc(m.name)} — Due ${money(dueAmount(m))}
    </option>
  `).join("");

  return `
    <div class="formGrid">
      <div class="field full">
        <label>Member</label>
        <select name="memberId" required>${options}</select>
      </div>

      <div class="field">
        <label>Payment Amount *</label>
        <input name="amount" type="number" min="1" value="${suggest || ""}" required>
      </div>

      <div class="field">
        <label>Payment Method</label>
        <select name="method">
          <option>Cash</option>
          <option>UPI</option>
          <option>Card</option>
          <option>Bank Transfer</option>
        </select>
      </div>

      <div class="field">
        <label>Date</label>
        <input name="date" type="date" value="${today()}">
      </div>

      <div class="field">
        <label>Note</label>
        <input name="note" placeholder="Payment note">
      </div>

      <div class="formActions field full">
        <button type="button" class="secondary" onclick="closeModal()">Cancel</button>
        <button class="primary">Save Payment</button>
      </div>
    </div>
  `;
}

function addPayment(memberId="", suggest=0){
  if(!db.members.length){
    toast("Add a member first");
    return;
  }

  modal("Add Payment", paymentForm(memberId, suggest), async fd => {
    const id = fd.get("memberId");
    const amount = Number(fd.get("amount"));

    if(!id || amount <= 0){
      toast("Enter a valid payment");
      return;
    }

    const payment = {
      id: uid(),
      memberId: id,
      amount,
      method: fd.get("method"),
      note: fd.get("note") || "",
      date: fd.get("date") || today()
    };
    db.payments.push(payment);
    logHistory("payment", "Payment received", `${member(id)?.name || "Member"} • ${money(amount)} • ${payment.method}`, "💳");

    save();
    toast("Payment saved");
  });
}

/* ================= MEMBER FORM ================= */

function calculateExpiry(joining, duration){
  const d = new Date((joining || today()) + "T00:00:00");
  d.setDate(d.getDate() + Math.max(0, Number(duration || 0)));
  return d.toISOString().slice(0,10);
}

function memberFields(m={}){
  const selectedPlanName = m.plan || db.plans[0]?.name || "";

  return `
    <div class="formGrid">

      <div class="field">
        <label>Full Name *</label>
        <input name="name" required value="${esc(m.name || "")}">
      </div>

      <div class="field">
        <label>Phone *</label>
        <input name="phone" required inputmode="tel" value="${esc(m.phone || "")}">
      </div>

      <div class="field">
        <label>Member ID</label>
        <input name="memberId" value="${esc(m.memberId || "FBC-" + Date.now().toString().slice(-5))}">
      </div>

      <div class="field">
        <label>Gender</label>
        <select name="gender">
          <option ${m.gender === "Male" ? "selected" : ""}>Male</option>
          <option ${m.gender === "Female" ? "selected" : ""}>Female</option>
          <option ${m.gender === "Other" ? "selected" : ""}>Other</option>
        </select>
      </div>

      <div class="field">
        <label>Joining Date</label>
        <input type="date" name="joining" value="${m.joining || today()}">
      </div>

      <div class="field">
        <label>Membership Plan</label>
        <select name="plan" id="memberPlan" required>
          ${db.plans.map(p => `
            <option
              value="${esc(p.name)}"
              data-price="${Number(p.price) || 0}"
              data-duration="${Number(p.duration) || 0}"
              ${selectedPlanName === p.name ? "selected" : ""}
            >
              ${esc(p.name)} — ${money(p.price)} / ${p.duration} days
            </option>
          `).join("")}
        </select>
      </div>

      <div class="field">
        <label>Plan Fee (Automatic)</label>
        <input id="planFeePreview" readonly>
      </div>

      <div class="field">
        <label>Expiry Date (Automatic)</label>
        <input type="date" id="memberExpiry" readonly>
      </div>

      <div class="field">
        <label>Initial Payment</label>
        <input name="initialPayment" type="number" min="0" value="${m.initialPayment ?? 0}">
      </div>

      <div class="field">
        <label>Aadhaar / ID Proof Number</label>
        <input name="idProof" value="${esc(m.idProof || "")}" inputmode="numeric">
      </div>

      <div class="field full">
        <label>Address</label>
        <textarea name="address" rows="2">${esc(m.address || "")}</textarea>
      </div>

      <div class="field full">
        <label>Member Photo</label>
        <input type="file" name="photo" accept="image/*">
      </div>

      <div class="formActions field full">
        <button type="button" class="secondary" onclick="closeModal()">Cancel</button>
        <button class="primary">Save Member</button>
      </div>
    </div>
  `;
}

function updateMemberPlanFields(){
  const plan = document.getElementById("memberPlan");
  const fee = document.getElementById("planFeePreview");
  const expiry = document.getElementById("memberExpiry");
  const joining = document.querySelector('#modalForm input[name="joining"]');

  if(!plan || !fee || !expiry) return;

  const opt = plan.options[plan.selectedIndex];
  const price = Number(opt?.dataset.price || 0);
  const duration = Number(opt?.dataset.duration || 0);

  fee.value = money(price);
  expiry.value = calculateExpiry(joining?.value || today(), duration);
}

function readFile(file){
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function addMember(editId=null){
  const existing = editId ? member(editId) : {};

  modal(
    editId ? "Edit Member" : "Add Member",
    memberFields(existing),
    async fd => {
      let photo = existing.photo || "";
      const file = fd.get("photo");

      if(file && file.size){
        photo = await readFile(file);
      }

      const planName = fd.get("plan");
      const plan = db.plans.find(p => p.name === planName);
      const joining = fd.get("joining") || today();

      const obj = {
        id: existing.id || uid(),
        name: fd.get("name").trim(),
        phone: fd.get("phone").trim(),
        memberId: fd.get("memberId").trim(),
        gender: fd.get("gender"),
        joining,
        expiry: calculateExpiry(joining, plan?.duration || 0),
        plan: planName,
        membershipFee: Number(plan?.price || 0),
        idProof: fd.get("idProof").trim(),
        address: fd.get("address").trim(),
        photo
      };

      if(editId){
        db.members = db.members.map(x => x.id === editId ? obj : x);
        logHistory("member", "Member updated", `${obj.name} • ${obj.memberId}`, "✏️");
        toast("Member updated");
      }else{
        db.members.unshift(obj);

        const initialPayment = Number(fd.get("initialPayment") || 0);

        if(initialPayment > 0){
          db.payments.push({
            id: uid(),
            memberId: obj.id,
            amount: initialPayment,
            method: "Cash",
            note: "Initial payment",
            date: today()
          });
          logHistory("payment", "Initial payment received", `${obj.name} • ${money(initialPayment)}`, "💳");
        }
        logHistory("member", "Member added", `${obj.name} • ${obj.memberId}`, "👤");
        toast("Member added successfully");
      }

      save();
    }
  );
}

document.getElementById("addMemberBtn").onclick = () => addMember();
document.getElementById("quickAdd").onclick = () => {
  openPage("members");
  addMember();
};

/* ================= MEMBERS ================= */

function memberImage(m){
  return m.photo || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Crect width='90' height='90' rx='45' fill='%23e2e8f0'/%3E%3Ctext x='45' y='54' text-anchor='middle' font-size='34' fill='%2364748b'%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E";
}

function renderMembers(){
  const search = (document.getElementById("memberSearch")?.value || "").toLowerCase();
  const filter = document.getElementById("memberFilter")?.value || "all";
  const box = document.getElementById("memberCards");
  if(!box) return;

  const list = db.members.filter(m => {
    const searchable = [m.name,m.phone,m.memberId,m.idProof,m.plan].join(" ").toLowerCase();
    if(search && !searchable.includes(search)) return false;
    if(filter === "active" && !isActive(m)) return false;
    if(filter === "expired" && isActive(m)) return false;
    if(filter === "due" && dueAmount(m) <= 0) return false;
    return true;
  });

  box.innerHTML = list.map(m => {
    const paid = paidAmount(m.id), due = dueAmount(m), alert = alertType(m);
    const status = paymentStatus(m);
    const statusClass = status === "PAID" ? "activeBadge" : status === "PARTIAL" ? "partialBadge" : "expiredBadge";
    const image = memberImage(m);
    const days = daysLeft(m.expiry);
    const expiryLabel = days < 0 ? `Expired ${Math.abs(days)} days ago` : days === 0 ? "Expires today" : `${days} days left`;
    return `
      <article class="memberCard ${alert}">
        <div class="memberTop">
          <button class="memberPhotoBtn" onclick="openPhotoViewer('${m.id}')" title="View photo">
            <img class="memberPhoto" src="${image}" alt="${esc(m.name)}">
            <span class="photoZoom">⌕</span>
          </button>
          <div class="memberInfo">
            <div class="memberNameRow">
              <div><h3>${esc(m.name)}</h3><small>ID: ${esc(m.memberId || "-")}</small></div>
              <button class="moreBtn" onclick="memberMenu('${m.id}')">⋮</button>
            </div>
            <div class="memberMeta">📞 ${esc(m.phone || "-")}</div>
            <div class="memberMeta">📋 ${esc(m.plan || "-")} • Joined ${esc(m.joining || "-")}</div>
            <div class="memberPayment ${due > 0 ? "due" : "paid"}">${due > 0 ? `Unpaid amount: ${money(due)}` : `Paid: ${money(paid)}`}</div>
            <div class="memberExpiry ${days < 0 ? "expired" : days <= 5 ? "soon" : "ok"}">${days < 0 ? "🔴" : days <= 5 ? "🟡" : "🟢"} Expires: ${esc(m.expiry || "-")} • ${expiryLabel}</div>
          </div>
        </div>
        <div class="memberStatusRow"><span class="badge ${statusClass}">${status}</span>${m.idProof ? `<span class="idProofMini">ID ✓</span>` : ""}</div>
        <div class="memberActions">
          <button onclick="callMember('${m.id}')"><span>📞</span><small>Call</small></button>
          <button class="payAction" onclick="payMember('${m.id}')"><span>💳</span><small>Pay</small></button>
          <button onclick="openWhatsApp('${m.id}')"><span>🟢</span><small>WhatsApp</small></button>
          <button onclick="markMemberAttendance('${m.id}')"><span>📅</span><small>Attendance</small></button>
        </div>
      </article>`;
  }).join("") || `<div class="card emptyMembers">No members found.</div>`;
}

function openPhotoViewer(id){
  const m = member(id); if(!m) return;
  const viewer = document.getElementById("photoViewer");
  document.getElementById("photoViewerImg").src = memberImage(m);
  document.getElementById("photoViewerName").textContent = m.name;
  viewer.classList.add("show");
  viewer.setAttribute("aria-hidden","false");
}
function closePhotoViewer(){
  const viewer = document.getElementById("photoViewer");
  viewer.classList.remove("show"); viewer.setAttribute("aria-hidden","true");
}
document.getElementById("photoClose")?.addEventListener("click", closePhotoViewer);
document.getElementById("photoViewer")?.addEventListener("click", e => { if(e.target.id === "photoViewer") closePhotoViewer(); });

function memberMenu(id){
  const m = member(id); if(!m) return;
  const action = prompt(`Member: ${m.name}\n\n1 = Pay\n2 = Edit\n3 = Delete\n\nEnter option:`);
  if(action === "1") addPayment(id, dueAmount(m));
  else if(action === "2") addMember(id);
  else if(action === "3") deleteMember(id);
}

function callMember(id){
  const m = member(id); if(!m?.phone) return toast("Phone number not available");
  window.location.href = `tel:${m.phone}`;
}
function payMember(id){
  const m = member(id);
  if(!m) return;
  addPayment(id, Math.max(0, dueAmount(m)));
}

function markMemberAttendance(id){
  if(!member(id)) return;
  if(db.attendance.some(a => a.memberId === id && a.date === today())) return toast("Attendance already marked today");
  const now = new Date();
  db.attendance.push({id:uid(), memberId:id, date:today(), time:now.toLocaleTimeString()});
  logHistory("attendance", "Attendance marked", `${member(id).name} • ${now.toLocaleTimeString()}`, "📅");
  save(); toast("Attendance marked");
}

let waMemberId = null;
let waTemplate = "payment";
function waText(id, type){
  const m = member(id); if(!m) return "";
  if(type === "expiry"){
    return `Dear ${m.name}, your ${m.plan || "gym"} plan expires on ${m.expiry || ""}. Please renew your membership to continue your workouts. Regards, FBC MANAGEMENT`;
  }
  return `Dear ${m.name}, you have an unpaid amount of ${money(dueAmount(m))}. Please pay this amount as soon as possible. Regards, FBC MANAGEMENT`;
}
function openWhatsApp(id){
  const m = member(id); if(!m?.phone) return toast("Phone number not available");
  waMemberId = id; waTemplate = "payment";
  document.getElementById("waTo").textContent = `To: ${m.name} • ${m.phone}`;
  document.getElementById("waMessage").value = waText(id, waTemplate);
  document.querySelectorAll(".waTemplate").forEach(b => b.classList.toggle("active", b.dataset.template === waTemplate));
  document.getElementById("whatsappModal").classList.add("show");
}
function closeWhatsApp(){ document.getElementById("whatsappModal")?.classList.remove("show"); }
document.querySelectorAll(".waTemplate").forEach(btn => btn.addEventListener("click", () => {
  waTemplate = btn.dataset.template;
  document.querySelectorAll(".waTemplate").forEach(b => b.classList.toggle("active", b === btn));
  if(waMemberId) document.getElementById("waMessage").value = waText(waMemberId, waTemplate);
}));
document.getElementById("waClose")?.addEventListener("click", closeWhatsApp);
document.getElementById("waCancel")?.addEventListener("click", closeWhatsApp);
document.getElementById("whatsappModal")?.addEventListener("click", e => { if(e.target.id === "whatsappModal") closeWhatsApp(); });
document.getElementById("waSend")?.addEventListener("click", () => {
  const m = member(waMemberId); if(!m?.phone) return;
  const text = document.getElementById("waMessage").value.trim();
  logHistory("member", "WhatsApp message prepared", `${m.name} • ${waTemplate === "expiry" ? "Plan Expiry" : "Payment Reminder"}`, "🟢");
  save();
  const phone = m.phone.replace(/\D/g, "");
  const normalized = phone.length === 10 ? "91" + phone : phone;
  window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(text)}`, "_blank");
  closeWhatsApp();
});

function deleteMember(id){
  const m = member(id);
  if(!m) return;

  if(confirm(`Delete ${m.name}?`)){
    db.members = db.members.filter(x => x.id !== id);
    db.payments = db.payments.filter(x => x.memberId !== id);
    db.attendance = db.attendance.filter(x => x.memberId !== id);
    db.workouts = db.workouts.filter(x => x.memberId !== id);
    logHistory("member", "Member deleted", `${m.name} • ${m.memberId || ""}`, "🗑️");

    save();
    toast("Member deleted");
  }
}

document.getElementById("memberSearch").oninput = renderMembers;
document.getElementById("memberFilter").onchange = renderMembers;

/* ================= ATTENDANCE ================= */

function renderAttendance(){
  const select = document.getElementById("attendanceMember");

  select.innerHTML = db.members.map(m => `
    <option value="${m.id}">
      ${esc(m.name)} — ${esc(m.memberId || "")}
    </option>
  `).join("") || `<option value="">No members</option>`;

  document.getElementById("attendanceTable").innerHTML =
    db.attendance.slice().reverse().map(a => `
      <tr>
        <td>${esc(a.date)}</td>
        <td>${esc(member(a.memberId)?.name || "Deleted member")}</td>
        <td>${esc(a.time)}</td>
      </tr>
    `).join("") ||
    `<tr><td colspan="3">No attendance records.</td></tr>`;
}

document.getElementById("checkInBtn").onclick = () => {
  const id = document.getElementById("attendanceMember").value;

  if(!id){
    toast("Add a member first");
    return;
  }

  const already = db.attendance.some(
    a => a.memberId === id && a.date === today()
  );

  if(already){
    toast("Attendance already marked today");
    return;
  }

  const now = new Date();

  db.attendance.push({
    id: uid(),
    memberId: id,
    date: today(),
    time: now.toLocaleTimeString()
  });
  logHistory("attendance", "Attendance marked", `${member(id)?.name || "Member"} • ${now.toLocaleTimeString()}`, "📅");

  save();
  toast("Attendance marked");
};

/* ================= PAYMENTS ================= */

function renderPayments(){
  document.getElementById("paymentsTable").innerHTML =
    db.payments.slice().reverse().map(p => `
      <tr>
        <td>${esc(p.date)}</td>
        <td>${esc(member(p.memberId)?.name || "Deleted member")}</td>
        <td><b>${money(p.amount)}</b></td>
        <td>${esc(p.method)}</td>
        <td>${esc(p.note || "-")}</td>
      </tr>
    `).join("") ||
    `<tr><td colspan="5">No payments found.</td></tr>`;
}

document.getElementById("addPaymentBtn").onclick = () => addPayment();

/* ================= SIMPLE RECORDS ================= */

function simpleAdd(type, title, fields){
  modal(
    title,
    `<div class="formGrid">
      ${fields}
      <div class="formActions field full">
        <button type="button" class="secondary" onclick="closeModal()">Cancel</button>
        <button class="primary">Save</button>
      </div>
    </div>`,
    async fd => {
      const item = {id: uid()};
      fd.forEach((value,key) => item[key] = value);
      db[type].push(item);
      const typeName = type === "workouts" ? "workout" : type === "diet" ? "diet" : type === "trainers" ? "trainer" : type === "plans" ? "plan" : type;
      logHistory(typeName, title + " saved", item.name || "New record", "📝");
      save();
      toast(title + " saved");
    }
  );
}

document.getElementById("addWorkoutBtn").onclick = () => {
  if(!db.members.length){
    toast("Add a member first");
    return;
  }

  simpleAdd(
    "workouts",
    "Add Workout",
    `
      <div class="field full">
        <label>Member</label>
        <select name="memberId">
          ${db.members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Workout</label>
        <input name="name" required>
      </div>
      <div class="field">
        <label>Sets / Reps</label>
        <input name="details">
      </div>
    `
  );
};

document.getElementById("addDietBtn").onclick = () => {
  simpleAdd(
    "diet",
    "Add Diet",
    `
      <div class="field">
        <label>Plan Name</label>
        <input name="name" required>
      </div>
      <div class="field">
        <label>Calories</label>
        <input name="calories" type="number">
      </div>
      <div class="field full">
        <label>Meals</label>
        <textarea name="meals"></textarea>
      </div>
    `
  );
};

document.getElementById("addTrainerBtn").onclick = () => {
  simpleAdd(
    "trainers",
    "Add Trainer",
    `
      <div class="field">
        <label>Name</label>
        <input name="name" required>
      </div>
      <div class="field">
        <label>Phone</label>
        <input name="phone" inputmode="tel">
      </div>
      <div class="field full">
        <label>Specialization</label>
        <input name="specialization">
      </div>
    `
  );
};

document.getElementById("addPlanBtn").onclick = () => {
  simpleAdd(
    "plans",
    "Add Membership Plan",
    `
      <div class="field">
        <label>Plan Name</label>
        <input name="name" required>
      </div>
      <div class="field">
        <label>Price</label>
        <input name="price" type="number" min="0" required>
      </div>
      <div class="field">
        <label>Duration (days)</label>
        <input name="duration" type="number" min="1" required>
      </div>
    `
  );
};

function cardDelete(type,id){
  const item = db[type]?.find(x => x.id === id);
  db[type] = db[type].filter(x => x.id !== id);
  const typeName = type === "workouts" ? "workout" : type === "diet" ? "diet" : type === "trainers" ? "trainer" : type === "plans" ? "plan" : type;
  logHistory(typeName, "Record deleted", item?.name || "Record", "🗑️");
  save();
  toast("Deleted");
}

function renderWorkouts(){
  document.getElementById("workoutList").innerHTML =
    db.workouts.map(x => `
      <div class="card">
        <h3>🏋️ ${esc(x.name)}</h3>
        <p><b>Member:</b> ${esc(member(x.memberId)?.name || "-")}</p>
        <p>${esc(x.details || "")}</p>
        <button class="danger" onclick="cardDelete('workouts','${x.id}')">Delete</button>
      </div>
    `).join("") ||
    `<div class="card">No workout plans yet.</div>`;
}

function renderDiet(){
  document.getElementById("dietList").innerHTML =
    db.diet.map(x => `
      <div class="card">
        <h3>🥗 ${esc(x.name)}</h3>
        <p>Calories: ${esc(x.calories || "-")}</p>
        <p>${esc(x.meals || "")}</p>
        <button class="danger" onclick="cardDelete('diet','${x.id}')">Delete</button>
      </div>
    `).join("") ||
    `<div class="card">No diet plans yet.</div>`;
}

function renderTrainers(){
  document.getElementById("trainerList").innerHTML =
    db.trainers.map(x => `
      <div class="card">
        <h3>🧑‍🏫 ${esc(x.name)}</h3>
        <p>${esc(x.phone || "")}</p>
        <p>${esc(x.specialization || "")}</p>
        <button class="danger" onclick="cardDelete('trainers','${x.id}')">Delete</button>
      </div>
    `).join("") ||
    `<div class="card">No trainers yet.</div>`;
}

function renderPlans(){
  document.getElementById("planList").innerHTML =
    db.plans.map(x => `
      <div class="card">
        <h3>📋 ${esc(x.name)}</h3>
        <p>${money(x.price)} / ${esc(x.duration)} days</p>
        <button class="danger" onclick="cardDelete('plans','${x.id}')">Delete</button>
      </div>
    `).join("");
}

/* ================= DASHBOARD ================= */

function renderDashboard(){
  const revenue = db.payments.reduce(
    (sum,p) => sum + Number(p.amount || 0), 0
  );

  const pending = db.members.reduce(
    (sum,m) => sum + dueAmount(m), 0
  );

  document.getElementById("statMembers").textContent = db.members.length;
  document.getElementById("statActive").textContent =
    db.members.filter(isActive).length;
  document.getElementById("statRevenue").textContent = money(revenue);
  document.getElementById("statToday").textContent =
    db.attendance.filter(a => a.date === today()).length;

  document.getElementById("smartStats").innerHTML = `
    <div class="smartStat">
      <b>${money(pending)}</b>
      <small>Total Pending</small>
    </div>

    <div class="smartStat yellow">
      <b>${db.members.filter(m => alertType(m) === "yellow").length}</b>
      <small>Expiring Within 5 Days</small>
    </div>

    <div class="smartStat red">
      <b>${db.members.filter(m => alertType(m) === "red").length}</b>
      <small>Expired Members</small>
    </div>
  `;

  document.getElementById("recentMembers").innerHTML =
    db.members.slice(0,5).map(m => `
      <div class="listItem ${alertType(m)}">
        <b>${esc(m.name)}</b>
        <br>
        <small>
          ${esc(m.plan || "-")}
          • Paid ${money(paidAmount(m.id))}
          • Due ${money(dueAmount(m))}
        </small>
      </div>
    `).join("") ||
    `<div class="listItem">No members yet.</div>`;
}

/* ================= REPORTS ================= */

function renderReports(){
  const totalFees = db.members.reduce(
    (sum,m) => sum + membershipTotal(m), 0
  );

  const paid = db.payments.reduce(
    (sum,p) => sum + Number(p.amount || 0), 0
  );

  const pending = Math.max(0, totalFees - paid);
  const dueMembers = db.members.filter(m => dueAmount(m) > 0).length;

  document.getElementById("repMembers").textContent = db.members.length;
  document.getElementById("repPayments").textContent = db.payments.length;
  document.getElementById("repAttendance").textContent = db.attendance.length;
  document.getElementById("repDueMembers").textContent = dueMembers;

  document.getElementById("reportSmart").innerHTML = `
    <div class="reportBox">
      <small>Total Fees</small>
      <b>${money(totalFees)}</b>
    </div>

    <div class="reportBox">
      <small>Total Paid</small>
      <b>${money(paid)}</b>
    </div>

    <div class="reportBox redBox">
      <small>Total Pending</small>
      <b>${money(pending)}</b>
    </div>

    <div class="reportBox yellowBox">
      <small>Due Members</small>
      <b>${dueMembers}</b>
    </div>
  `;

  document.getElementById("expiryList").innerHTML =
    db.members.slice()
      .sort((a,b) => daysLeft(a.expiry) - daysLeft(b.expiry))
      .map(m => `
        <div class="listItem ${alertType(m)}">
          <b>${esc(m.name)}</b>
          — ${esc(m.expiry || "-")}
          — Paid ${money(paidAmount(m.id))}
          — Due ${money(dueAmount(m))}
          <br>
          <button
            class="primary"
            style="margin-top:7px;padding:7px 10px"
            onclick="addPayment('${m.id}',${dueAmount(m)})">
            💳 Pay
          </button>
        </div>
      `).join("") ||
    `<div class="listItem">No members.</div>`;
}

/* ================= BACKUP ================= */

function makeBackupData(){
  return {
    app: FBC_CONFIG.appName,
    version: FBC_CONFIG.version,
    exportedAt: new Date().toISOString(),
    data: db
  };
}

function makeBackupBlob(){
  return new Blob(
    [JSON.stringify(makeBackupData(), null, 2)],
    {type:"application/json"}
  );
}

document.getElementById("exportBtn").onclick = () => {
  const blob = makeBackupBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `FBC-BACKUP-${today()}.json`;
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 500);
  toast("Backup downloaded");
};

document.getElementById("importBtn").onclick = () => {
  const file = document.getElementById("importFile").files[0];

  if(!file){
    toast("Select JSON backup first");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      const data = parsed.data || parsed;

      if(!Array.isArray(data.members)){
        throw new Error("Invalid backup");
      }

      db = {
        members: Array.isArray(data.members) ? data.members : [],
        attendance: Array.isArray(data.attendance) ? data.attendance : [],
        payments: Array.isArray(data.payments) ? data.payments : [],
        workouts: Array.isArray(data.workouts) ? data.workouts : [],
        diet: Array.isArray(data.diet) ? data.diet : [],
        trainers: Array.isArray(data.trainers) ? data.trainers : [],
        plans: Array.isArray(data.plans) && data.plans.length ? data.plans : clone(defaultPlans),
        history: Array.isArray(data.history) ? data.history : []
      };

      save();
      toast("Backup restored successfully");
    }catch(error){
      console.error(error);
      toast("Invalid backup file");
    }
  };

  reader.readAsText(file);
};

/* ================= GOOGLE DRIVE ================= */

function loadGIS(){
  return new Promise((resolve,reject) => {
    if(window.google?.accounts?.oauth2){
      resolve();
      return;
    }

    const existing = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );

    if(existing){
      existing.addEventListener("load", resolve, {once:true});
      existing.addEventListener("error", reject, {once:true});
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function getDriveToken(){
  return new Promise((resolve,reject) => {
    if(!window.google?.accounts?.oauth2){
      reject(new Error("Google Identity Services unavailable"));
      return;
    }

    const client = google.accounts.oauth2.initTokenClient({
      client_id: FBC_CONFIG.googleClientId,
      scope: FBC_CONFIG.googleDriveScope,
      callback: response => {
        if(response.error){
          reject(response);
        }else{
          resolve(response.access_token);
        }
      }
    });

    client.requestAccessToken({prompt:"consent"});
  });
}

async function uploadToDrive(){
  if(!navigator.onLine){
    toast("Internet is required for Google Drive");
    return;
  }

  if(
    !FBC_CONFIG.googleClientId ||
    FBC_CONFIG.googleClientId.includes("PASTE_")
  ){
    toast("Add Google Client ID in config.js");
    return;
  }

  try{
    toast("Connecting to Google Drive...");

    await loadGIS();

    const token = await getDriveToken();
    const blob = makeBackupBlob();

    const metadata = {
      name:
        `FBC-BACKUP-${new Date().toISOString().replace(/[:.]/g,"-")}.json`,
      mimeType:"application/json"
    };

    const form = new FormData();

    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], {
        type:"application/json"
      })
    );

    form.append("file", blob);

    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method:"POST",
        headers:{
          Authorization:"Bearer " + token
        },
        body:form
      }
    );

    if(!response.ok){
      throw new Error(await response.text());
    }

    toast("Backup uploaded to Google Drive");
  }catch(error){
    console.error(error);
    toast("Drive upload failed — check OAuth/test user settings");
  }
}

document.getElementById("driveBtn").onclick = uploadToDrive;

/* ================= RENDER ================= */

function renderAll(){
  renderDashboard();
  renderMembers();
  renderAttendance();
  renderPayments();
  renderWorkouts();
  renderDiet();
  renderTrainers();
  renderPlans();
  renderReports();
  renderHistory();
}

renderAll();
