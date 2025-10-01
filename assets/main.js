// 年份
const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

// 移动端菜单
const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');
if (toggle && links) {
  toggle.addEventListener('click', () => {
    const opened = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(opened));
  });
}

// 安全属性兜底：所有外链 target=_blank 都加 rel
document.querySelectorAll('a[target="_blank"]').forEach(a => {
  const rel = a.getAttribute('rel') || '';
  if (!/noopener|noreferrer/.test(rel)) {
    a.setAttribute('rel', (rel + ' noopener noreferrer').trim());
  }
});

// reveal on scroll for projects section
const revealEls = document.querySelectorAll('#projects, #projects .card');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('reveal-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

revealEls.forEach(el => {
  el.classList.add('reveal-on-scroll');
  revealObserver.observe(el);
});


