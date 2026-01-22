/* ==========================================================================
   Shringaar Theme - Global JavaScript
   ========================================================================== */

/**
 * Utility Functions
 */
const Shringaar = {
  /**
   * Debounce function to limit execution rate
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(fn, delay = 300) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Throttle function to limit execution frequency
   * @param {Function} fn - Function to throttle
   * @param {number} limit - Time limit in milliseconds
   * @returns {Function} Throttled function
   */
  throttle(fn, limit = 300) {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  /**
   * Fetch wrapper with error handling
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise} Fetch promise
   */
  async fetchJSON(url, options = {}) {
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    try {
      const response = await fetch(url, { ...defaultOptions, ...options });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  },

  /**
   * Parse JSON from a script tag
   * @param {HTMLElement} element - Element containing JSON
   * @returns {Object|null} Parsed JSON or null
   */
  parseJSON(element) {
    if (!element) return null;
    try {
      return JSON.parse(element.textContent);
    } catch (error) {
      console.error('JSON parse error:', error);
      return null;
    }
  },

  /**
   * Format money based on Shopify money format
   * @param {number} cents - Amount in cents
   * @param {string} format - Money format string
   * @returns {string} Formatted money string
   */
  formatMoney(cents, format = '${{amount}}') {
    if (typeof cents === 'string') {
      cents = cents.replace('.', '');
    }

    const value = cents / 100;
    const formatString = format || '${{amount}}';

    const formatWithDelimiters = (number, precision = 2, thousands = ',', decimal = '.') => {
      if (isNaN(number) || number == null) return '0';

      const fixed = number.toFixed(precision);
      const parts = fixed.split('.');
      const dollarsAmount = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, `$1${thousands}`);
      const centsAmount = parts[1] ? decimal + parts[1] : '';

      return dollarsAmount + centsAmount;
    };

    let formattedValue = '';
    switch (formatString.match(/\{\{\s*(\w+)\s*\}\}/)[1]) {
      case 'amount':
        formattedValue = formatWithDelimiters(value, 2);
        break;
      case 'amount_no_decimals':
        formattedValue = formatWithDelimiters(value, 0);
        break;
      case 'amount_with_comma_separator':
        formattedValue = formatWithDelimiters(value, 2, '.', ',');
        break;
      case 'amount_no_decimals_with_comma_separator':
        formattedValue = formatWithDelimiters(value, 0, '.', ',');
        break;
      default:
        formattedValue = formatWithDelimiters(value, 2);
    }

    return formatString.replace(/\{\{\s*\w+\s*\}\}/, formattedValue);
  },

  /**
   * Trap focus within an element (for modals/drawers)
   * @param {HTMLElement} container - Container element
   */
  trapFocus(container) {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    container.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          e.preventDefault();
        }
      }
    });

    firstFocusable?.focus();
  },

  /**
   * Publish a custom event
   * @param {string} eventName - Name of the event
   * @param {Object} detail - Event detail
   */
  publish(eventName, detail = {}) {
    document.dispatchEvent(new CustomEvent(eventName, { detail }));
  },

  /**
   * Subscribe to a custom event
   * @param {string} eventName - Name of the event
   * @param {Function} callback - Callback function
   */
  subscribe(eventName, callback) {
    document.addEventListener(eventName, callback);
  }
};

// Make Shringaar available globally
window.Shringaar = Shringaar;

/**
 * Cart functionality
 */
class CartAPI {
  constructor() {
    this.routes = {
      cart: '/cart.js',
      add: '/cart/add.js',
      change: '/cart/change.js',
      update: '/cart/update.js',
      clear: '/cart/clear.js',
    };
  }

  async getCart() {
    return Shringaar.fetchJSON(this.routes.cart);
  }

  async addItem(id, quantity = 1, properties = {}) {
    const body = JSON.stringify({
      id,
      quantity,
      properties,
    });

    const cart = await Shringaar.fetchJSON(this.routes.add, {
      method: 'POST',
      body,
    });

    Shringaar.publish('cart:updated', { cart });
    return cart;
  }

  async updateItem(line, quantity) {
    const body = JSON.stringify({ line, quantity });

    const cart = await Shringaar.fetchJSON(this.routes.change, {
      method: 'POST',
      body,
    });

    Shringaar.publish('cart:updated', { cart });
    return cart;
  }

  async removeItem(line) {
    return this.updateItem(line, 0);
  }

  async clearCart() {
    const cart = await Shringaar.fetchJSON(this.routes.clear, {
      method: 'POST',
    });

    Shringaar.publish('cart:updated', { cart });
    return cart;
  }
}

// Initialize cart API
window.cart = new CartAPI();

/**
 * Disclosure (accordion/dropdown) component
 */
class DisclosureComponent extends HTMLElement {
  constructor() {
    super();
    this.toggle = this.querySelector('[data-disclosure-toggle]');
    this.content = this.querySelector('[data-disclosure-content]');
  }

  connectedCallback() {
    this.toggle?.addEventListener('click', this.handleToggle.bind(this));
  }

  handleToggle() {
    const isOpen = this.hasAttribute('open');

    if (isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.setAttribute('open', '');
    this.toggle?.setAttribute('aria-expanded', 'true');
    this.content?.removeAttribute('hidden');
  }

  close() {
    this.removeAttribute('open');
    this.toggle?.setAttribute('aria-expanded', 'false');
    this.content?.setAttribute('hidden', '');
  }
}

customElements.define('disclosure-component', DisclosureComponent);

/**
 * Modal component
 */
class ModalComponent extends HTMLElement {
  constructor() {
    super();
    this.openTriggers = document.querySelectorAll(`[data-modal-open="${this.id}"]`);
    this.closeTriggers = this.querySelectorAll('[data-modal-close]');
    this.overlay = this.querySelector('[data-modal-overlay]');
  }

  connectedCallback() {
    this.openTriggers.forEach(trigger => {
      trigger.addEventListener('click', this.open.bind(this));
    });

    this.closeTriggers.forEach(trigger => {
      trigger.addEventListener('click', this.close.bind(this));
    });

    this.overlay?.addEventListener('click', this.close.bind(this));

    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  open() {
    this.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
    Shringaar.trapFocus(this);
  }

  close() {
    this.removeAttribute('open');
    document.body.style.overflow = '';
  }
}

customElements.define('modal-component', ModalComponent);

/**
 * Quantity input component
 */
class QuantityInput extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('input[type="number"]');
    this.decreaseBtn = this.querySelector('[data-decrease]');
    this.increaseBtn = this.querySelector('[data-increase]');
  }

  connectedCallback() {
    this.decreaseBtn?.addEventListener('click', () => this.decrease());
    this.increaseBtn?.addEventListener('click', () => this.increase());
    this.input?.addEventListener('change', () => this.validate());
  }

  get value() {
    return parseInt(this.input?.value || 1);
  }

  set value(val) {
    if (this.input) {
      this.input.value = val;
      this.input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  get min() {
    return parseInt(this.input?.min || 1);
  }

  get max() {
    return parseInt(this.input?.max || 9999);
  }

  decrease() {
    if (this.value > this.min) {
      this.value = this.value - 1;
    }
  }

  increase() {
    if (this.value < this.max) {
      this.value = this.value + 1;
    }
  }

  validate() {
    if (this.value < this.min) {
      this.value = this.min;
    } else if (this.value > this.max) {
      this.value = this.max;
    }
  }
}

customElements.define('quantity-input', QuantityInput);

/**
 * Initialize on DOM ready
 */
document.addEventListener('DOMContentLoaded', () => {
  // Add js class to html for progressive enhancement
  document.documentElement.classList.add('js-ready');

  // Handle lazy loading for images
  if ('loading' in HTMLImageElement.prototype) {
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    lazyImages.forEach(img => {
      if (img.dataset.src) {
        img.src = img.dataset.src;
      }
    });
  }
});
