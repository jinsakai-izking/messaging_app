// ========== NAVBAR SCROLL EFFECT ==========
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// ========== HAMBURGER MENU TOGGLE ==========
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger?.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  navMenu.classList.toggle('active');
});

// ========== SMOOTH SCROLL + ACTIVE LINK ==========
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('section[id]');

window.addEventListener('scroll', () => {
  let scrollPos = window.scrollY;
  sections.forEach(section => {
    if (scrollPos >= section.offsetTop - 200) {
      let id = section.getAttribute('id');
      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${id}`) {
          link.classList.add('active');
        }
      });
    }
  });
});

// ========== SCROLL ANIMATION ==========
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('animate');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.scroll-animate').forEach(el => observer.observe(el));

// ========== TYPEWRITER FOR HERO ==========
function typeWriter(el, text, speed = 70) {
  let i = 0;
  el.textContent = '';
  function type() {
    if (i < text.length) {
      el.textContent += text.charAt(i++);
      setTimeout(type, speed);
    }
  }
  type();
}

window.addEventListener('load', () => {
  const heroTitle = document.querySelector('.hero h1');
  if (heroTitle) {
    const text = heroTitle.dataset.text || heroTitle.textContent;
    typeWriter(heroTitle, text);
  }
});

// ========== CONTACT FORM VALIDATION ==========
function showNotification(message, type = 'info') {
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();

  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.textContent = message;
  Object.assign(n.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    background: type === 'success' ? '#54ffbd' : '#ff4f5e',
    color: '#000',
    padding: '1rem 1.25rem',
    fontWeight: '600',
    borderRadius: '0.5rem',
    zIndex: 10000,
    boxShadow: '0 6px 12px rgba(0,0,0,0.2)'
  });

  document.body.appendChild(n);
  setTimeout(() => n.remove(), 5000);
}

document.getElementById('contactForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const message = form.message.value.trim();

  if (!name || !email || !message) {
    showNotification('Please fill all fields', 'error');
    return;
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    showNotification('Enter a valid email', 'error');
    return;
  }

  showNotification('Message sent successfully!', 'success');
  form.reset();
});

// ========== OPTIONAL: HERO PARALLAX (Subtle) ==========
window.addEventListener('scroll', () => {
  const hero = document.querySelector('.hero');
  if (hero) {
    const offset = window.scrollY * -0.3;
    hero.style.backgroundPositionY = `${offset}px`;
  }
});
