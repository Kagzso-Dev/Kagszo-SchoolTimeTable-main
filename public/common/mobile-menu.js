/**
 * 📱 Mobile Menu Handler
 * Handles mobile navigation menu open/close
 */

(function() {
  'use strict';

  function initMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const menu = document.getElementById('mobileMenu');
    const closeBtn = document.getElementById('mobileMenuClose');

    if (!menuBtn || !menu) return;

    // Open menu
    menuBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      menu.classList.add('active');
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    });

    // Close menu
    function closeMenu() {
      menu.classList.remove('active');
      document.body.style.overflow = ''; // Restore scroll
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeMenu);
    }

    // Close on menu item click
    const menuItems = menu.querySelectorAll('.mobile-menu-item');
    menuItems.forEach(item => {
      item.addEventListener('click', function() {
        setTimeout(closeMenu, 300); // Small delay for navigation
      });
    });

    // Close on outside click
    menu.addEventListener('click', function(e) {
      if (e.target === menu) {
        closeMenu();
      }
    });

    // Close on ESC key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && menu.classList.contains('active')) {
        closeMenu();
      }
    });

    // Make closeMenu available globally
    window.closeMobileMenu = closeMenu;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileMenu);
  } else {
    initMobileMenu();
  }
})();



