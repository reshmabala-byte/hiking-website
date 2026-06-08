// ===== DATA LAYER (localStorage) =====
const STORE = 'trailquest_hikes';

function loadHikes() {
  try { return JSON.parse(localStorage.getItem(STORE)) || []; }
  catch { return []; }
}
function saveHikes(hikes) {
  localStorage.setItem(STORE, JSON.stringify(hikes));
}

// Seed with sample data on first visit
function maybeSeed() {
  if (localStorage.getItem(STORE + '_seeded')) return;
  const samples = [
    {
      id: uid(), type: 'past',
      name: 'Angel's Landing', location: 'Zion National Park, UT',
      date: '2023-10-14', difficulty: 'hard',
      distance: 5.4, elevation: 1488, rating: 5,
      hikers: ['Reshma', 'Amit', 'Priya', 'Rahul'],
      notes: 'Absolutely stunning views from the top. The chain section was thrilling! Started early to beat the crowds.',
      photo: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400&q=80'
    },
    {
      id: uid(), type: 'past',
      name: 'Mirror Lake Loop', location: 'Yosemite, CA',
      date: '2022-06-20', difficulty: 'easy',
      distance: 5, elevation: 150, rating: 4,
      hikers: ['Reshma', 'Amit'],
      notes: 'Perfect spring hike. Mirror Lake was partially dry but the reflection was still magical.',
      photo: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&q=80'
    },
    {
      id: uid(), type: 'past',
      name: 'Emerald Lake Trail', location: 'Rocky Mountain NP, CO',
      date: '2021-08-07', difficulty: 'moderate',
      distance: 3.6, elevation: 650, rating: 5,
      hikers: ['Reshma', 'Amit', 'Priya'],
      notes: 'Three stunning lakes in one hike — Nymph, Dream, and Emerald. Snow lingered on the peaks even in August.',
      photo: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80'
    },
    {
      id: uid(), type: 'upcoming',
      name: 'Half Dome via Cable Route', location: 'Yosemite, CA',
      date: '2026-09-12', difficulty: 'strenuous',
      distance: 16, elevation: 4800, rating: 0,
      hikers: ['Reshma', 'Amit', 'Rahul', 'Deepa'],
      notes: 'Need permits — applying in spring lottery. Everyone needs hiking poles and gloves for the cables.',
      photo: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=400&q=80'
    },
    {
      id: uid(), type: 'upcoming',
      name: 'Enchantments Core Zone', location: 'Leavenworth, WA',
      date: '2026-08-20', difficulty: 'strenuous',
      distance: 19, elevation: 4500, rating: 0,
      hikers: ['Reshma', 'Amit'],
      notes: 'Permit required via recreation.gov lottery. Plan for overnight camping in Upper Snow Zone.',
      photo: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=400&q=80'
    }
  ];
  saveHikes(samples);
  localStorage.setItem(STORE + '_seeded', '1');
}

function uid() { return '_' + Math.random().toString(36).slice(2, 10); }

// ===== STATE =====
let editingId = null;
let deletingId = null;
let currentHikers = [];

// ===== TABS =====
document.querySelectorAll('.plan-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.plan-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.plan-section').forEach(s => s.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
    if (btn.dataset.tab === 'stats') renderStats();
  });
});

// ===== RENDER PAST =====
function renderPast() {
  const q = (document.getElementById('search-past')?.value || '').toLowerCase();
  const hikes = loadHikes().filter(h => h.type === 'past').filter(h => matches(h, q));
  hikes.sort((a, b) => new Date(b.date) - new Date(a.date));
  const el = document.getElementById('past-list');
  const empty = document.getElementById('past-empty');
  el.innerHTML = hikes.map(h => hikeCard(h)).join('');
  empty.style.display = hikes.length ? 'none' : 'block';
}

// ===== RENDER UPCOMING =====
function renderUpcoming() {
  const q = (document.getElementById('search-upcoming')?.value || '').toLowerCase();
  const hikes = loadHikes().filter(h => h.type === 'upcoming').filter(h => matches(h, q));
  hikes.sort((a, b) => new Date(a.date) - new Date(b.date));
  const el = document.getElementById('upcoming-list');
  const empty = document.getElementById('upcoming-empty');
  el.innerHTML = hikes.map(h => hikeCard(h)).join('');
  empty.style.display = hikes.length ? 'none' : 'block';
}

function matches(h, q) {
  if (!q) return true;
  return [h.name, h.location, h.notes, ...(h.hikers || [])].some(v => (v || '').toLowerCase().includes(q));
}

// ===== CARD TEMPLATE =====
function hikeCard(h) {
  const diffBadge = { easy: 'badge-easy', moderate: 'badge-moderate', hard: 'badge-hard', strenuous: 'badge-hard' };
  const diffLabel = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard', strenuous: 'Strenuous' };
  const stars = h.rating ? '★'.repeat(h.rating) + '☆'.repeat(5 - h.rating) : '';
  const hikerChips = (h.hikers || []).map(n => `<span class="hiker-chip">👤 ${esc(n)}</span>`).join('');

  const photoStyle = h.photo
    ? `background-image:url('${esc(h.photo)}')`
    : 'background-color:#c8e6c9';
  const photoIcon = h.photo ? '' : '⛰️';

  let dateLine = '';
  if (h.type === 'upcoming') {
    const days = Math.ceil((new Date(h.date) - new Date()) / 86400000);
    let cls = 'countdown-badge';
    let txt = '';
    if (days < 0) { cls += ' past'; txt = 'Date passed'; }
    else if (days === 0) { cls += ' soon'; txt = 'Today!'; }
    else if (days <= 30) { cls += ' soon'; txt = `${days} days away`; }
    else { txt = `${days} days away`; }
    dateLine = `<span>${fmtDate(h.date)}</span><span class="${cls}">${txt}</span>`;
  } else {
    dateLine = `<span>📅 ${fmtDate(h.date)}</span>`;
  }

  return `
  <div class="hike-card" id="card-${h.id}">
    <div class="hike-card-photo" style="${photoStyle}">${photoIcon}</div>
    <div class="hike-card-body">
      <div class="hike-card-top">
        <div>
          <h3>${esc(h.name)}</h3>
          ${h.difficulty ? `<span class="badge ${diffBadge[h.difficulty] || 'badge-moderate'}" style="margin-top:.4rem;display:inline-block">${diffLabel[h.difficulty] || h.difficulty}</span>` : ''}
        </div>
        <div class="hike-card-actions">
          <button class="icon-btn" title="Edit" onclick="openModal('${h.type}', '${h.id}')">✏️</button>
          <button class="icon-btn delete" title="Delete" onclick="deleteHike('${h.id}')">🗑️</button>
        </div>
      </div>
      <div class="hike-meta">
        ${dateLine}
        ${h.location ? `<span>📍 ${esc(h.location)}</span>` : ''}
        ${h.distance ? `<span>📐 ${h.distance} mi</span>` : ''}
        ${h.elevation ? `<span>↑ ${h.elevation.toLocaleString()} ft</span>` : ''}
        ${stars ? `<span class="stars-display">${stars}</span>` : ''}
      </div>
      ${hikerChips ? `<div class="hike-hikers">${hikerChips}</div>` : ''}
      ${h.notes ? `<div class="hike-notes">${esc(h.notes)}</div>` : ''}
    </div>
  </div>`;
}

// ===== STATS =====
function renderStats() {
  const hikes = loadHikes();
  const past = hikes.filter(h => h.type === 'past');
  const upcoming = hikes.filter(h => h.type === 'upcoming');
  const totalMiles = past.reduce((s, h) => s + (parseFloat(h.distance) || 0), 0);
  const totalElev  = past.reduce((s, h) => s + (parseInt(h.elevation) || 0), 0);
  const avgRating  = past.filter(h => h.rating).reduce((s, h, _, a) => s + h.rating / a.length, 0);

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><div class="big">${past.length}</div><div class="lbl">Hikes Completed</div></div>
    <div class="stat-card"><div class="big">${totalMiles.toFixed(1)}</div><div class="lbl">Total Miles Hiked</div></div>
    <div class="stat-card"><div class="big">${totalElev.toLocaleString()}</div><div class="lbl">Total Feet Climbed</div></div>
    <div class="stat-card"><div class="big">${avgRating ? avgRating.toFixed(1) + '★' : '—'}</div><div class="lbl">Average Rating</div></div>
    <div class="stat-card"><div class="big">${upcoming.length}</div><div class="lbl">Planned Ahead</div></div>
  `;

  // Count hikers across all past hikes
  const hikerCount = {};
  past.forEach(h => (h.hikers || []).forEach(n => { hikerCount[n] = (hikerCount[n] || 0) + 1; }));
  const sorted = Object.entries(hikerCount).sort((a, b) => b[1] - a[1]);
  document.getElementById('top-hikers').innerHTML = sorted.length
    ? sorted.map(([name, count]) => `<div class="hiker-stat"><div class="hiker-count">${count}</div><div class="hiker-name">${esc(name)}</div></div>`).join('')
    : '<p style="color:#999">No hike data yet.</p>';
}

// ===== MODAL =====
function openModal(type, id) {
  editingId = id || null;
  currentHikers = [];

  const modal = document.getElementById('modal-backdrop');
  const form  = document.getElementById('hike-form');
  form.reset();
  setStars(0);
  document.getElementById('hiker-tags').innerHTML = '';
  document.getElementById('hike-id').value   = id || '';
  document.getElementById('hike-type').value = type;

  // Label tweaks per type
  document.getElementById('date-label').textContent = type === 'upcoming' ? 'Planned Date *' : 'Date Hiked *';
  const ratingGroup = document.getElementById('rating-group');
  ratingGroup.style.display = type === 'upcoming' ? 'none' : '';

  if (id) {
    // Edit existing
    document.getElementById('modal-title').textContent = 'Edit Hike';
    const h = loadHikes().find(x => x.id === id);
    if (h) {
      document.getElementById('f-name').value      = h.name || '';
      document.getElementById('f-location').value  = h.location || '';
      document.getElementById('f-date').value      = h.date || '';
      document.getElementById('f-difficulty').value = h.difficulty || '';
      document.getElementById('f-distance').value  = h.distance || '';
      document.getElementById('f-elevation').value = h.elevation || '';
      document.getElementById('f-notes').value     = h.notes || '';
      document.getElementById('f-photo').value     = h.photo || '';
      setStars(h.rating || 0);
      currentHikers = [...(h.hikers || [])];
      renderHikerTags();
    }
  } else {
    document.getElementById('modal-title').textContent = type === 'upcoming' ? 'Add Upcoming Hike' : 'Add Past Hike';
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-backdrop')) return;
  document.getElementById('modal-backdrop').classList.add('hidden');
  document.body.style.overflow = '';
  editingId = null;
  currentHikers = [];
}

// Call without event (button click)
window.closeModal = function(e) {
  document.getElementById('modal-backdrop').classList.add('hidden');
  document.body.style.overflow = '';
  editingId = null;
  currentHikers = [];
};

// ===== SAVE =====
function saveHike(e) {
  e.preventDefault();
  const id   = editingId || uid();
  const type = document.getElementById('hike-type').value;

  const hike = {
    id,
    type,
    name:       document.getElementById('f-name').value.trim(),
    location:   document.getElementById('f-location').value.trim(),
    date:       document.getElementById('f-date').value,
    difficulty: document.getElementById('f-difficulty').value,
    distance:   parseFloat(document.getElementById('f-distance').value) || 0,
    elevation:  parseInt(document.getElementById('f-elevation').value) || 0,
    rating:     parseInt(document.getElementById('f-rating').value) || 0,
    hikers:     [...currentHikers],
    notes:      document.getElementById('f-notes').value.trim(),
    photo:      document.getElementById('f-photo').value.trim(),
  };

  const hikes = loadHikes();
  if (editingId) {
    const idx = hikes.findIndex(h => h.id === editingId);
    if (idx !== -1) hikes[idx] = hike;
  } else {
    hikes.push(hike);
  }
  saveHikes(hikes);

  window.closeModal();
  if (type === 'past') renderPast(); else renderUpcoming();
}

// ===== DELETE =====
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
  const hikes = loadHikes();
  const h = hikes.find(x => x.id === deletingId);
  const type = h?.type;
  saveHikes(hikes.filter(x => x.id !== deletingId));
  cancelDelete();
  if (type === 'past') renderPast(); else renderUpcoming();
}

// ===== HIKERS =====
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
  document.getElementById('hiker-tags').innerHTML = currentHikers
    .map(n => `<span class="hiker-tag">${esc(n)}<button type="button" onclick="removeHiker('${esc(n)}')">&times;</button></span>`)
    .join('');
}

// Enter key in hiker input
document.getElementById('hiker-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addHiker(); }
});

// ===== STAR RATING =====
function setStars(val) {
  document.getElementById('f-rating').value = val;
  document.querySelectorAll('.star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.val) <= val);
  });
}
document.querySelectorAll('.star').forEach(star => {
  star.addEventListener('click', () => setStars(parseInt(star.dataset.val)));
  star.addEventListener('mouseover', () => {
    document.querySelectorAll('.star').forEach(s => {
      s.classList.toggle('active', parseInt(s.dataset.val) <= parseInt(star.dataset.val));
    });
  });
  star.addEventListener('mouseout', () => {
    setStars(parseInt(document.getElementById('f-rating').value));
  });
});

// ===== UTILS =====
function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T12:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ===== INIT =====
maybeSeed();
renderPast();
renderUpcoming();
