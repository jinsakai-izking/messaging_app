// ============ Navigation Toggle =============
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  navMenu.classList.toggle('active');
});

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
  });
});

// ============ Scroll Spy =============
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
  let scrollY = window.scrollY;
  sections.forEach(current => {
    const sectionHeight = current.offsetHeight;
    const sectionTop = current.offsetTop - 150;
    const sectionId = current.getAttribute('id');

    if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${sectionId}`) {
          link.classList.add('active');
        }
      });
    }
  });
});

// ============ Scroll Reveal =============
const animatedItems = document.querySelectorAll('.scroll-animate');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('animate');
    }
  });
}, { threshold: 0.1 });

animatedItems.forEach(item => {
  item.classList.add('scroll-animate');
  observer.observe(item);
});

// ============ Typing Animation =============
function typeWriter(element, text, speed = 70) {
  let i = 0;
  element.textContent = '';
  (function type() {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  })();
}

window.addEventListener('load', () => {
  const heroTitle = document.querySelector('.hero h1');
  if (heroTitle) {
    typeWriter(heroTitle, heroTitle.dataset.text || heroTitle.textContent, 50);
  }
});

// ============ Contact Notification =============
function showNotification(msg, type = 'info') {
  const prev = document.querySelector('.notification');
  if (prev) prev.remove();

  const box = document.createElement('div');
  box.className = `notification ${type}`;
  box.textContent = msg;

  Object.assign(box.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '1rem 1.5rem',
    background: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6',
    color: '#fff',
    borderRadius: '0.5rem',
    boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
    zIndex: '1000'
  });

  document.body.appendChild(box);

  setTimeout(() => box.remove(), 5000);
}

// ============ Contact Form Validation =============
const contactForm = document.getElementById('contactForm');

if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = contactForm.name.value.trim();
    const email = contactForm.email.value.trim();
    const message = contactForm.message.value.trim();

    if (!name || !email || !message) {
      return showNotification('Please fill all fields.', 'error');
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return showNotification('Invalid email format.', 'error');
    }

    showNotification('Message sent successfully!', 'success');
    contactForm.reset();
  });
}
