/**
 * 🎨 Modern Toast Notification System
 * Usage: Toast.show('Message', 'success|error|warning|info')
 */

class Toast {
  static container = null;

  static init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    }
  }

  static show(message, type = 'info', duration = 3000) {
    this.init();
    
    const toast = document.createElement('div');
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#6366f1'
    };

    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      background: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 300px;
      max-width: 400px;
      border-left: 4px solid ${colors[type]};
      pointer-events: auto;
      animation: slideInRight 0.3s ease, fadeOut 0.3s ease ${duration}ms forwards;
      transform: translateX(0);
    `;

    const iconSpan = document.createElement('span');
    iconSpan.style.fontSize = '20px';
    iconSpan.textContent = icons[type];

    const msgSpan = document.createElement('span');
    msgSpan.style.cssText = 'flex:1; color:#1f2937; font-weight:500;';
    msgSpan.textContent = message; // textContent prevents XSS

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = 'background:none; border:none; font-size:18px; cursor:pointer; color:#9ca3af; padding:0; width:20px; height:20px; display:flex; align-items:center; justify-content:center;';
    closeBtn.addEventListener('click', () => toast.remove());

    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    toast.appendChild(closeBtn);

    this.container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);

    return toast;
  }

  static success(message, duration) {
    return this.show(message, 'success', duration);
  }

  static error(message, duration) {
    return this.show(message, 'error', duration);
  }

  static warning(message, duration) {
    return this.show(message, 'warning', duration);
  }

  static info(message, duration) {
    return this.show(message, 'info', duration);
  }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }

  @keyframes fadeOut {
    to {
      opacity: 0.7;
    }
  }
`;
document.head.appendChild(style);

// Make Toast available globally
window.Toast = Toast;



