/* ============================================
   LAKEHOUSE MENTORSHIP - Main JS
   ============================================ */

document.addEventListener('DOMContentLoaded', function () {

  /* --- Navbar scroll effect --- */
  const nav = document.querySelector('.site-nav');
  if (nav) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 50) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    });
  }

  /* --- Mobile menu toggle --- */
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      links.classList.toggle('open');
      toggle.classList.toggle('active');
    });

    // Close menu when clicking a link
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('open');
        toggle.classList.remove('active');
      });
    });
  }

  /* --- Scroll-triggered animations --- */
  const animateElements = document.querySelectorAll('.animate-in');
  if (animateElements.length > 0 && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = 'running';
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

    animateElements.forEach(function (el) {
      el.style.animationPlayState = 'paused';
      observer.observe(el);
    });
  }

  /* --- Smooth scroll for anchor links --- */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        var headerOffset = 80;
        var elementPosition = target.getBoundingClientRect().top;
        var offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      }
    });
  });

  /* --- Tooltip edge detection --- */
  document.querySelectorAll('.lh-tip').forEach(function (tip) {
    tip.addEventListener('mouseenter', function () {
      var box = tip.querySelector('.lh-tip-box');
      if (!box) return;
      // Reset classes
      box.classList.remove('tip-left', 'tip-right');
      // Check position after a frame
      requestAnimationFrame(function () {
        var rect = box.getBoundingClientRect();
        if (rect.left < 8) {
          box.classList.add('tip-left');
        } else if (rect.right > window.innerWidth - 8) {
          box.classList.add('tip-right');
        }
      });
    });
  });

  /* --- Active nav link highlighting --- */
  var currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.nav-links a').forEach(function (link) {
    var linkPath = link.getAttribute('href').replace(/\/$/, '') || '/';
    if (currentPath === linkPath || (linkPath !== '/' && currentPath.startsWith(linkPath))) {
      link.classList.add('active');
    }
  });

});
