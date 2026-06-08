// ═══════════════════════════════════════════════════════
//  planning.js  –  loads trails.json then drives all tabs
// ═══════════════════════════════════════════════════════

// ── localStorage keys ──
const STORE      = 'trailquest_hikes';
const GEAR_KEY   = 'trailquest_gear_checks';
const PROD_KEY   = 'trailquest_prod_filter';

// ── global JSON payload (loaded once) ──
let TRAIL_DATA = null;

// ── per-session state ──
let editingId   = null;
let deletingId  = null;
let currentHikers = [];
let activeProductFilter = 'All';

// ═══════════════════════════════════════
// 1. BOOTSTRAP
// ═══════════════════════════════════════
async function init() {
  showBanner(true);
  try {
    const res = await fetch('trails.json');
    if (!res.ok) throw new Error('fetch failed');
    TRAIL_DATA = await res.json();
    seedFromJSON();          // one-time import into localStorage
  } catch (e) {
    console.warn('trails.json not available, using localStorage only:', e.message);
  }
  showBanner(false);

  renderPast();
  renderUpcoming();
  wireStars();
  wireTabs();
  wireHikerInput();
  wireMobileNav();
}

function showBanner(on) {
  const b = document.getElementById('load-banner');
  if (b) b.style.display = on ? 'flex' : 'none';
}

// ── import JSON hikes into localStorage on first visit ──
function seedFromJSON() {
  if (!TRAIL_DATA) return;
  const SEEDED = 'trailquest_json_seeded';
  if (localStorage.getItem(SEEDED)) return;

  const existing = loadHikes();

  TRAIL_DATA.past_hikes.forEach(h => {
    existing.push({
      id:         uid(),
      type:       'past',
      name:       h.name,
      location:   h.location || '',
      date:       h.dates?.start || h.dates?.approx || '',
      difficulty: h.difficulty || guessDifficulty(h),
      distance:   h.daily_miles || h.miles_rt || 0,
      elevation:  h.elevation_gain_ft || h.daily_elevation_gain_ft || 0,
      rating:     h.rating || 5,
      hikers:     h.participants || [],
      notes:      h.notes || '',
      photo:      h.photo || '',
      source:     'json',
    });
  });

  TRAIL_DATA.upcoming_hikes.forEach(h => {
    existing.push({
      id:         uid(),
      type:       'upcoming',
      name:       h.name,
      location:   h.location || '',
      date:       h.dates?.start || '',
      difficulty: h.difficulty || '',
      distance:   0,
      elevation:  0,
      rating:     0,
      hikers:     h.participants_confirmed || h.participants || [],
      notes:      h.notes || '',
      photo:      '',
      source:     'json',
    });
  });

  saveHikes(existing);
  localStorage.setItem(SEEDED, '1');
}

function guessDifficulty(h) {
  const gain = h.elevation_gain_ft || h.daily_elevation_gain_ft || 0;
  if (gain >= 3000) return 'strenuous';
  if (gain >= 1500) return 'hard';
  if (gain >= 600)  return 'moderate';
  return 'easy';
}

// ═══════════════════════════════════════
// 2. STORAGE HELPERS
// ═══════════════════════════════════════
function loadHikes() {
  try { return JSON.parse(localStorage.getItem(STORE)) || []; }
  catch { return []; }
}
function saveHikes(h) { localStorage.setItem(STORE, JSON.stringify(h)); }
function uid() { return '_' + Math.random().toString(36).slice(2, 10); }

// ═══════════════════════════════════════
// 3. TAB WIRING
// ═══════════════════════════════════════
function wireTabs() {
  document.querySelectorAll('.plan-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.plan-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.plan-section').forEach(s => s.classList.add('hidden'));
      btn.classList.add('active');
      const id = 'tab-' + btn.dataset.tab;
      document.getElementById(id).classList.remove('hidden');

      if (btn.dataset.tab === 'stats') renderStats();
      if (btn.dataset.tab === 'gear')  renderGear();
      if (btn.dataset.tab === 'tips')  renderTips();
    });
  });
}

// ═══════════════════════════════════════
// 4. PAST HIKES
// ═══════════════════════════════════════
function renderPast() {
  const q = (document.getElementById('search-past')?.value || '').toLowerCase();
  const hikes = loadHikes()
    .filter(h => h.type === 'past')
    .filter(h => matches(h, q))
    .sort((a, b) => {
      const da = parseDateLoose(a.date), db = parseDateLoose(b.date);
      return db - da;
    });

  document.getElementById('past-list').innerHTML  = hikes.map(hikeCard).join('');
  document.getElementById('past-empty').style.display = hikes.length ? 'none' : 'block';
}

// ═══════════════════════════════════════
// 5. UPCOMING HIKES
// ═══════════════════════════════════════
function renderUpcoming() {
  const q = (document.getElementById('search-upcoming')?.value || '').toLowerCase();
  const hikes = loadHikes()
    .filter(h => h.type === 'upcoming')
    .filter(h => matches(h, q))
    .sort((a, b) => parseDateLoose(a.date) - parseDateLoose(b.date));

  document.getElementById('upcoming-list').innerHTML  = hikes.map(hikeCard).join('');
  document.getElementById('upcoming-empty').style.display = hikes.length ? 'none' : 'block';
}

function matches(h, q) {
  if (!q) return true;
  return [h.name, h.location, h.notes, ...(h.hikers || [])]
    .some(v => (v || '').toLowerCase().includes(q));
}

// ═══════════════════════════════════════
// 6. HIKE CARD TEMPLATE
// ═══════════════════════════════════════
const DIFF_BADGE = { easy:'badge-easy', moderate:'badge-moderate', hard:'badge-hard', strenuous:'badge-hard' };
const DIFF_LABEL = { easy:'Easy', moderate:'Moderate', hard:'Hard', strenuous:'Strenuous' };

function hikeCard(h) {
  const stars = h.rating ? '★'.repeat(h.rating) + '☆'.repeat(5 - h.rating) : '';
  const chips  = (h.hikers || []).map(n => `<span class="hiker-chip">&#128100; ${esc(n)}</span>`).join('');
  const diff   = h.difficulty;

  const photoStyle = h.photo
    ? `background-image:url('${esc(h.photo)}')`
    : 'background-color:#c8e6c9';
  const photoIcon = h.photo ? '' : '&#9968;';

  // Date / countdown
  let dateLine;
  if (h.type === 'upcoming') {
    const days = Math.ceil((parseDateLoose(h.date) - Date.now()) / 86400000);
    let cls = 'countdown-badge', txt = '';
    if (!h.date || isNaN(days)) { txt = 'Date TBD'; }
    else if (days < 0)          { cls += ' past';  txt = 'Date passed'; }
    else if (days === 0)        { cls += ' soon';  txt = 'Today!'; }
    else if (days <= 30)        { cls += ' soon';  txt = `${days} days away`; }
    else                        { txt = `${days} days away`; }
    dateLine = `<span>&#128197; ${fmtDate(h.date)}</span><span class="${cls}">${txt}</span>`;
  } else {
    dateLine = `<span>&#128197; ${fmtDate(h.date)}</span>`;
  }

  return `
  <div class="hike-card">
    <div class="hike-card-photo" style="${photoStyle}">${photoIcon}</div>
    <div class="hike-card-body">
      <div class="hike-card-top">
        <div>
          <h3>${esc(h.name)}</h3>
          ${diff ? `<span class="badge ${DIFF_BADGE[diff] || 'badge-moderate'}">${DIFF_LABEL[diff] || diff}</span>` : ''}
        </div>
        <div class="hike-card-actions">
          <button class="icon-btn" title="Edit"   onclick="openModal('${h.type}','${h.id}')">&#9999;&#65039;</button>
          <button class="icon-btn delete" title="Delete" onclick="deleteHike('${h.id}')">&#128465;&#65039;</button>
        </div>
      </div>
      <div class="hike-meta">
        ${dateLine}
        ${h.location  ? `<span>&#128205; ${esc(h.location)}</span>`          : ''}
        ${h.distance  ? `<span>&#128208; ${h.distance} mi</span>`             : ''}
        ${h.elevation ? `<span>&#8593; ${Number(h.elevation).toLocaleString()} ft</span>` : ''}
        ${stars       ? `<span class="stars-display">${stars}</span>`         : ''}
      </div>
      ${chips ? `<div class="hike-hikers">${chips}</div>` : ''}
      ${h.notes ? `<div class="hike-notes">${esc(h.notes)}</div>` : ''}
    </div>
  </div>`;
}

// ═══════════════════════════════════════
// 7. GEAR TAB
// ═══════════════════════════════════════
function renderGear() {
  if (!TRAIL_DATA) {
    document.getElementById('gear-checklist').innerHTML =
      '<li class="empty-msg">Load trails.json to see gear list.</li>';
    return;
  }

  const gear   = TRAIL_DATA.gear;
  const checks = JSON.parse(localStorage.getItem(GEAR_KEY) || '{}');

  // ── Checklist ──
  const list = gear.official_guide_list || [];
  document.getElementById('gear-checklist').innerHTML = list.map((item, i) => {
    const key     = 'gear_' + i;
    const checked = checks[key] ? 'checked' : '';
    return `
    <li class="gear-item ${checks[key] ? 'gear-done' : ''}">
      <label>
        <input type="checkbox" ${checked} onchange="toggleGear('${key}', this.checked, this.closest('li'))"/>
        <span>${esc(item)}</span>
      </label>
    </li>`;
  }).join('');

  // ── Rental box ──
  const r = gear.rental_in_nepal || {};
  document.getElementById('rental-box').innerHTML = `
    <h4>Rent in Nepal</h4>
    <ul class="info-list">
      <li><strong>Sleeping bag:</strong> ${esc(r.sleeping_bag || '')}</li>
      <li><strong>Trekking poles:</strong> ${esc(r.trekking_poles || '')}</li>
      <li><strong>Other gear:</strong> ${esc(r.other_gear || '')}</li>
    </ul>
    <p class="hint-text">${esc(r.note || '')}</p>`;

  // ── Packing tips ──
  const tips = gear.packing_tips || [];
  document.getElementById('packing-tips-box').innerHTML = `
    <h4>Packing Tips</h4>
    <ul class="info-list">
      ${tips.map(t => `<li>${esc(t)}</li>`).join('')}
    </ul>`;

  // ── Products ──
  renderProducts();
}

function toggleGear(key, checked, li) {
  const checks = JSON.parse(localStorage.getItem(GEAR_KEY) || '{}');
  checks[key] = checked;
  localStorage.setItem(GEAR_KEY, JSON.stringify(checks));
  li.classList.toggle('gear-done', checked);
}

function clearGearChecks() {
  localStorage.removeItem(GEAR_KEY);
  renderGear();
}

// ── Products ──
function renderProducts() {
  if (!TRAIL_DATA) return;
  const products = TRAIL_DATA.products_to_buy || [];

  // Build category filter buttons
  const cats = ['All', ...new Set(products.map(p => p.category))];
  document.getElementById('products-filter').innerHTML = cats.map(c =>
    `<button class="filter-btn ${c === activeProductFilter ? 'active' : ''}"
      onclick="setProductFilter('${esc(c)}')">${esc(c)}</button>`
  ).join('');

  const filtered = activeProductFilter === 'All'
    ? products
    : products.filter(p => p.category === activeProductFilter);

  document.getElementById('products-grid').innerHTML = filtered.map(p => {
    const price  = p.price_usd
      ? (typeof p.price_usd === 'object'
          ? Object.entries(p.price_usd).map(([k,v]) => `${k}: $${v}`).join(' &middot; ')
          : `$${p.price_usd}`)
      : '';
    const linkBtn = p.link
      ? `<a href="${esc(p.link)}" target="_blank" rel="noopener" class="btn btn-sm">View &rarr;</a>`
      : '';
    return `
    <div class="product-card">
      <div class="product-cat-tag">${esc(p.category)}</div>
      <h4>${esc(p.item)}</h4>
      ${p.brand ? `<p class="product-brand">${esc(p.brand)}</p>` : ''}
      ${p.description ? `<p class="product-desc">${esc(p.description)}</p>` : ''}
      ${p.notes ? `<p class="product-notes">${esc(p.notes)}</p>` : ''}
      <div class="product-footer">
        ${price ? `<span class="product-price">${price}</span>` : '<span></span>'}
        <div style="display:flex;gap:.5rem;align-items:center;">
          ${p.where_to_buy ? `<span class="product-store">${esc(p.where_to_buy)}</span>` : ''}
          ${linkBtn}
        </div>
      </div>
      ${p.recommended_by ? `<p class="product-rec">&#128172; ${esc(p.recommended_by)}</p>` : ''}
    </div>`;
  }).join('');
}

function setProductFilter(cat) {
  activeProductFilter = cat;
  renderProducts();
}

// ═══════════════════════════════════════
// 8. GROUP TIPS TAB
// ═══════════════════════════════════════
const TIP_ICONS = {
  'Altitude Acclimatization': '&#129514;',
  'Training Plan':            '&#127939;',
  'Gear & Packing':           '&#127890;',
  'Nepal Logistics':          '&#9992;&#65039;',
  'Tea House Life on the Trail': '&#127968;',
  'Health & Safety':          '&#129656;',
};

function renderTips() {
  if (!TRAIL_DATA) {
    document.getElementById('tips-accordion').innerHTML =
      '<p class="empty-msg">Load trails.json to see group tips.</p>';
    return;
  }

  const recs = TRAIL_DATA.user_recommendations || [];
  document.getElementById('tips-accordion').innerHTML = recs.map((rec, i) => {
    const icon = TIP_ICONS[rec.topic] || '&#128161;';
    const items = (rec.tips || []).map(t => `<li>${esc(t)}</li>`).join('');
    return `
    <div class="accordion-item">
      <button class="accordion-header" onclick="toggleAccordion(${i})">
        <span>${icon} ${esc(rec.topic)}</span>
        <span class="accordion-arrow" id="arrow-${i}">&#8964;</span>
      </button>
      <ul class="accordion-body" id="acc-${i}">${items}</ul>
    </div>`;
  }).join('');

  // Open first by default
  if (recs.length) toggleAccordion(0);
}

function toggleAccordion(i) {
  const body  = document.getElementById('acc-' + i);
  const arrow = document.getElementById('arrow-' + i);
  if (!body) return;
  const open = !body.classList.contains('open');
  // close all
  document.querySelectorAll('.accordion-body').forEach(b => b.classList.remove('open'));
  document.querySelectorAll('.accordion-arrow').forEach(a => a.classList.remove('rotated'));
  // open clicked
  if (open) {
    body.classList.add('open');
    if (arrow) arrow.classList.add('rotated');
  }
}

// ═══════════════════════════════════════
// 9. STATS TAB
// ═══════════════════════════════════════
function renderStats() {
  const hikes   = loadHikes();
  const past     = hikes.filter(h => h.type === 'past');
  const upcoming = hikes.filter(h => h.type === 'upcoming');

  const totalMiles = past.reduce((s, h) => s + (parseFloat(h.distance)  || 0), 0);
  const totalElev  = past.reduce((s, h) => s + (parseInt(h.elevation)   || 0), 0);
  const ratings    = past.filter(h => h.rating > 0);
  const avgRating  = ratings.length
    ? (ratings.reduce((s, h) => s + h.rating, 0) / ratings.length).toFixed(1)
    : null;

  document.getElementById('stats-grid').innerHTML = [
    { big: past.length,                    lbl: 'Hikes Completed' },
    { big: totalMiles.toFixed(1),          lbl: 'Total Miles Hiked' },
    { big: totalElev.toLocaleString(),     lbl: 'Total Feet Climbed' },
    { big: avgRating ? avgRating + '&#9733;' : '&mdash;', lbl: 'Avg Rating' },
    { big: upcoming.length,                lbl: 'Adventures Planned' },
  ].map(s => `
    <div class="stat-card">
      <div class="big">${s.big}</div>
      <div class="lbl">${s.lbl}</div>
    </div>`).join('');

  // Hiker leaderboard (from past hike participants)
  const hikerCount = {};
  past.forEach(h => (h.hikers || []).forEach(n => {
    hikerCount[n] = (hikerCount[n] || 0) + 1;
  }));
  const sorted = Object.entries(hikerCount).sort((a, b) => b[1] - a[1]);
  document.getElementById('top-hikers').innerHTML = sorted.length
    ? sorted.map(([name, count]) => `
        <div class="hiker-stat">
          <div class="hiker-count">${count}</div>
          <div class="hiker-name">${esc(name)}</div>
        </div>`).join('')
    : '<p class="empty-msg" style="padding:0">No data yet.</p>';

  // Chat activity leaders from JSON
  const leaders = TRAIL_DATA ? Object.entries(TRAIL_DATA.participants || {}).slice(0, 8) : [];
  document.getElementById('chat-leaders').innerHTML = leaders.length
    ? leaders.map(([name, count]) => `
        <div class="hiker-stat">
          <div class="hiker-count">${count}</div>
          <div class="hiker-name">${esc(name)}</div>
        </div>`).join('')
    : '<p class="empty-msg" style="padding:0">Load trails.json to see chat stats.</p>';
}

// ═══════════════════════════════════════
// 10. ADD / EDIT MODAL
// ═══════════════════════════════════════
function openModal(type, id) {
  editingId     = id || null;
  currentHikers = [];

  const form = document.getElementById('hike-form');
  form.reset();
  setStars(0);
  document.getElementById('hiker-tags').innerHTML  = '';
  document.getElementById('hike-id').value         = id || '';
  document.getElementById('hike-type').value       = type;
  document.getElementById('date-label').textContent =
    type === 'upcoming' ? 'Planned Date *' : 'Date Hiked *';
  document.getElementById('rating-group').style.display =
    type === 'upcoming' ? 'none' : '';

  if (id) {
    document.getElementById('modal-title').textContent = 'Edit Hike';
    const h = loadHikes().find(x => x.id === id);
    if (h) {
      document.getElementById('f-name').value       = h.name       || '';
      document.getElementById('f-location').value   = h.location   || '';
      document.getElementById('f-date').value       = isoDate(h.date);
      document.getElementById('f-difficulty').value = h.difficulty || '';
      document.getElementById('f-distance').value   = h.distance   || '';
      document.getElementById('f-elevation').value  = h.elevation  || '';
      document.getElementById('f-notes').value      = h.notes      || '';
      document.getElementById('f-photo').value      = h.photo      || '';
      setStars(h.rating || 0);
      currentHikers = [...(h.hikers || [])];
      renderHikerTags();
    }
  } else {
    document.getElementById('modal-title').textContent =
      type === 'upcoming' ? 'Add Upcoming Hike' : 'Add Past Hike';
  }

  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.add('hidden');
  document.body.style.overflow = '';
  editingId     = null;
  currentHikers = [];
}

function saveHike(e) {
  e.preventDefault();
  const id   = editingId || uid();
  const type = document.getElementById('hike-type').value;

  const hike = {
    id, type,
    name:       document.getElementById('f-name').value.trim(),
    location:   document.getElementById('f-location').value.trim(),
    date:       document.getElementById('f-date').value,
    difficulty: document.getElementById('f-difficulty').value,
    distance:   parseFloat(document.getElementById('f-distance').value) || 0,
    elevation:  parseInt(document.getElementById('f-elevation').value)  || 0,
    rating:     parseInt(document.getElementById('f-rating').value)     || 0,
    hikers:     [...currentHikers],
    notes:      document.getElementById('f-notes').value.trim(),
    photo:      document.getElementById('f-photo').value.trim(),
  };

  const all = loadHikes();
  if (editingId) {
    const idx = all.findIndex(h => h.id === editingId);
    if (idx !== -1) all[idx] = hike; else all.push(hike);
  } else {
    all.push(hike);
  }
  saveHikes(all);
  closeModal();
  type === 'past' ? renderPast() : renderUpcoming();
}

// ═══════════════════════════════════════
// 11. DELETE
// ═══════════════════════════════════════
function deleteHike(id) {
  deletingId = id;
  document.getElementById('delete-backdrop').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function cancelDelete() {
  deletingId = null;
  document.getElementById('delete-backdrop').classList.add('hidden');
  document.body.style.overflow = '';
}
function confirmDelete() {
  if (!deletingId) return;
  const all  = loadHikes();
  const type = all.find(h => h.id === deletingId)?.type;
  saveHikes(all.filter(h => h.id !== deletingId));
  cancelDelete();
  type === 'past' ? renderPast() : renderUpcoming();
}

// ═══════════════════════════════════════
// 12. HIKER TAG INPUT
// ═══════════════════════════════════════
function wireHikerInput() {
  document.getElementById('hiker-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addHiker(); }
  });
}
function addHiker() {
  const input = document.getElementById('hiker-input');
  const name  = input.value.trim();
  if (!name || currentHikers.includes(name)) { input.value = ''; return; }
  currentHikers.push(name);
  input.value = '';
  renderHikerTags();
}
function removeHiker(name) {
  currentHikers = currentHikers.filter(n => n !== name);
  renderHikerTags();
}
function renderHikerTags() {
  document.getElementById('hiker-tags').innerHTML = currentHikers.map(n =>
    `<span class="hiker-tag">${esc(n)}
       <button type="button" onclick="removeHiker('${esc(n)}')">&times;</button>
     </span>`).join('');
}

// ═══════════════════════════════════════
// 13. STAR RATING
// ═══════════════════════════════════════
function wireStars() {
  document.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => setStars(+star.dataset.val));
    star.addEventListener('mouseover', () => highlightStars(+star.dataset.val));
    star.addEventListener('mouseout',  () => setStars(+document.getElementById('f-rating').value));
  });
}
function setStars(val) {
  document.getElementById('f-rating').value = val;
  highlightStars(val);
}
function highlightStars(val) {
  document.querySelectorAll('.star').forEach(s =>
    s.classList.toggle('active', +s.dataset.val <= val));
}

// ═══════════════════════════════════════
// 14. MOBILE NAV
// ═══════════════════════════════════════
function wireMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');
  if (toggle) toggle.addEventListener('click', () => links.classList.toggle('open'));
}

// ═══════════════════════════════════════
// 15. UTILITIES
// ═══════════════════════════════════════
function fmtDate(str) {
  if (!str) return 'TBD';
  // Handle loose strings like "Before December 2023"
  if (!/^\d/.test(str)) return str;
  const d = new Date(str + (str.length === 10 ? 'T12:00:00' : ''));
  if (isNaN(d)) return str;
  return d.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
}

function isoDate(str) {
  if (!str || !/^\d/.test(str)) return '';
  const d = new Date(str + (str.length === 10 ? 'T12:00:00' : ''));
  if (isNaN(d)) return '';
  return d.toISOString().slice(0, 10);
}

function parseDateLoose(str) {
  if (!str) return 0;
  const d = new Date(str + (str.length === 10 ? 'T12:00:00' : ''));
  return isNaN(d) ? 0 : d.getTime();
}

function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ═══════════════════════════════════════
// START
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', init);
