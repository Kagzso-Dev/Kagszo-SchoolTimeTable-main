/**
 * 🎨 Modern Loading Spinner Component
 * Usage: Loading.show() / Loading.hide()
 */

class Loading {
  static overlay = null;

  static show(message = 'Loading...') {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.id = 'loading-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      animation: fadeIn 0.2s ease;
    `;

    const spinner = document.createElement('div');
    spinner.style.cssText = `
      background: white;
      padding: 32px 40px;
      border-radius: 16px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.3);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      min-width: 200px;
    `;

    const loader = document.createElement('div');
    loader.className = 'spinner';
    loader.style.cssText = `
      width: 48px;
      height: 48px;
      border: 4px solid #f3f4f6;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    `;

    const text = document.createElement('div');
    text.textContent = message;
    text.style.cssText = `
      color: #1f2937;
      font-weight: 500;
      font-size: 14px;
    `;

    spinner.appendChild(loader);
    spinner.appendChild(text);
    this.overlay.appendChild(spinner);
    document.body.appendChild(this.overlay);

    // Add animation styles
    if (!document.getElementById('loading-styles')) {
      const style = document.createElement('style');
      style.id = 'loading-styles';
      style.textContent = `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  static hide() {
    if (!this.overlay) return;

    this.overlay.style.animation = 'fadeOut 0.2s ease forwards';
    setTimeout(() => {
      if (this.overlay && this.overlay.parentElement) {
        this.overlay.remove();
      }
      this.overlay = null;
    }, 200);
  }
}

window.Loading = Loading;



