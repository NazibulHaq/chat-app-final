console.log('[Macro] macro.js loaded');

class MacroManager {
  constructor() {
    this.macros = new Map();
    this.isAdmin = false;
    this.setupEventListeners();
    this.loadMacros();
    console.log('[Macro] MacroManager initialized');
  }

  async loadMacros() {
    try {
      const response = await fetch('/api/macros');
      const macros = await response.json();
      this.macros.clear();
      macros.forEach(macro => this.macros.set(macro.keyword, macro));
      console.log('[Macro] Loaded macros:', macros);
    } catch (error) {
      console.error('[Macro] Failed to load macros:', error);
    }
  }

  setupEventListeners() {
    // Check if user is admin
    fetch('/api/user')
      .then(res => res.json())
      .then(user => {
        this.isAdmin = user.type === 'admin';
        if (this.isAdmin) {
          this.setupAdminUI();
        }
        console.log('[Macro] User type:', user.type);
      });

    // Setup macro input handling
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
      messageInput.addEventListener('input', this.handleInput.bind(this));
      messageInput.addEventListener('keydown', this.handleKeydown.bind(this));
      console.log('[Macro] Event listeners attached to message input');
    } else {
      console.warn('[Macro] No message input found');
    }
  }

  setupAdminUI() {
    const messageForm = document.getElementById('message-form');
    if (!messageForm) return;

    // Add macro button
    const macroButton = document.createElement('button');
    macroButton.type = 'button';
    macroButton.className = 'macro-button';
    macroButton.innerHTML = '⚡';
    macroButton.title = 'Manage Macros';
    messageForm.insertBefore(macroButton, messageForm.firstChild);

    // Create macro popup
    const popup = document.createElement('div');
    popup.className = 'macro-popup';
    popup.innerHTML = `
      <h2>Create Macro</h2>
      <form class="macro-form">
        <input type="text" placeholder="Keyword (e.g., greeting)" maxlength="20" required>
        <textarea placeholder="Macro content" maxlength="500" required></textarea>
        <button type="submit">Save Macro</button>
      </form>
    `;
    document.body.appendChild(popup);

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'macro-overlay';
    document.body.appendChild(overlay);

    // Setup popup events
    macroButton.addEventListener('click', () => {
      popup.classList.add('active');
      overlay.classList.add('active');
    });

    overlay.addEventListener('click', () => {
      popup.classList.remove('active');
      overlay.classList.remove('active');
    });

    popup.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const keyword = popup.querySelector('input').value;
      const body = popup.querySelector('textarea').value;

      try {
        const response = await fetch('/api/macros', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword, body })
        });

        if (!response.ok) {
          const error = await response.json();
          alert(error.error);
          return;
        }

        await this.loadMacros();
        popup.classList.remove('active');
        overlay.classList.remove('active');
        popup.querySelector('form').reset();
      } catch (error) {
        console.error('Failed to create macro:', error);
        alert('Failed to create macro');
      }
    });
  }

  handleInput(e) {
    const input = e.target;
    const text = input.textContent;
    const lastWord = text.split(/\s/).pop();

    if (lastWord.startsWith('#')) {
      this.showMacroDropdown(input, lastWord);
    } else {
      this.hideMacroDropdown();
    }
  }

  handleKeydown(e) {
    if (e.key === 'Escape') {
      this.hideMacroDropdown();
    }
  }

  showMacroDropdown(input, prefix) {
    this.hideMacroDropdown();

    const matchingMacros = Array.from(this.macros.entries())
      .filter(([keyword]) => keyword.startsWith(prefix.slice(1)))
      .slice(0, 5);

    if (matchingMacros.length === 0) return;

    const dropdown = document.createElement('div');
    dropdown.className = 'macro-dropdown active';

    matchingMacros.forEach(([keyword, macro]) => {
      const item = document.createElement('div');
      item.className = 'macro-item';
      item.innerHTML = `
        <div class="macro-keyword">#${keyword}</div>
        <div class="macro-preview">${macro.body}</div>
      `;
      item.addEventListener('click', () => {
        const text = input.textContent;
        const lastWordIndex = text.lastIndexOf(prefix);
        input.textContent = text.slice(0, lastWordIndex) + macro.body;
        this.hideMacroDropdown();
      });
      dropdown.appendChild(item);
    });

    const rect = input.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + window.scrollY}px`;
    dropdown.style.left = `${rect.left + window.scrollX}px`;
    document.body.appendChild(dropdown);
  }

  hideMacroDropdown() {
    const dropdown = document.querySelector('.macro-dropdown');
    if (dropdown) {
      dropdown.remove();
    }
  }
}

// Initialize macro manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.macroManager = new MacroManager();
}); 