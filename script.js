// Mobile nav toggle
const toggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
if (toggle) {
  toggle.addEventListener('click', () => navLinks.classList.toggle('open'));
}

// Newsletter subscribe
function handleSubscribe(e) {
  e.preventDefault();
  const msg = document.getElementById('sub-msg');
  if (msg) {
    msg.textContent = '🎉 You\'re subscribed! Happy hiking.';
    e.target.reset();
  }
}

// Trail filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    document.querySelectorAll('.card[data-difficulty]').forEach(card => {
      card.style.display = (filter === 'all' || card.dataset.difficulty === filter) ? '' : 'none';
    });
  });
});

// Contact form
function handleContact(e) {
  e.preventDefault();
  const msg = document.getElementById('contact-msg');
  if (msg) {
    msg.textContent = '✅ Message sent! We\'ll get back to you within 24 hours.';
    msg.style.color = '#2d6a4f';
    e.target.reset();
  }
}

// Navbar scroll effect
window.addEventListener('scroll', () => {
  const nav = document.querySelector('.navbar');
  if (nav) nav.style.boxShadow = window.scrollY > 40 ? '0 2px 20px rgba(0,0,0,.4)' : '';
});
