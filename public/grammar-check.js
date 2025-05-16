// Grammar check service using LanguageTool API
class GrammarCheckService {
  constructor() {
    this.apiUrl = 'https://api.languagetool.org/v2/check';
    this.debounceTimeout = 300;
    this.cache = new Map();
  }

  // Debounced grammar check
  async checkText(text) {
    if (!text.trim()) return null;
    // Check cache first
    const cached = this.cache.get(text);
    if (cached) return cached;
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          text,
          language: 'en-US',
        }),
      });
      if (!response.ok) throw new Error('Grammar check failed');
      const result = await response.json();
      this.cache.set(text, result);
      return result;
    } catch (error) {
      // Show a visible error message if API fails
      const existing = document.getElementById('grammar-error-banner');
      if (!existing) {
        const banner = document.createElement('div');
        banner.id = 'grammar-error-banner';
        banner.textContent = 'Grammar check service unavailable. You can still send messages.';
        banner.style.position = 'fixed';
        banner.style.bottom = '0';
        banner.style.left = '0';
        banner.style.right = '0';
        banner.style.background = '#ff3b3b';
        banner.style.color = '#fff';
        banner.style.textAlign = 'center';
        banner.style.padding = '8px 0';
        banner.style.zIndex = '9999';
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 5000);
      }
      return null;
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }
}

// Create and export a singleton instance
const grammarCheckService = new GrammarCheckService();
export default grammarCheckService; 