// Grammar check UI components
class GrammarUI {
  constructor() {
    this.suggestionPopup = null;
    this.createSuggestionPopup();
  }

  // Create the suggestion popup element
  createSuggestionPopup() {
    this.suggestionPopup = document.createElement('div');
    this.suggestionPopup.className = 'grammar-suggestion-popup';
    this.suggestionPopup.style.display = 'none';
    document.body.appendChild(this.suggestionPopup);
  }

  // Show grammar suggestions for a word
  showSuggestions(word, suggestions, rect, explanation = 'Correct the spelling error') {
    if (!suggestions || suggestions.length === 0) return;

    const popup = this.suggestionPopup;
    popup.innerHTML = '';

    // Explanation
    const explanationDiv = document.createElement('div');
    explanationDiv.className = 'grammar-explanation';
    explanationDiv.textContent = explanation;
    popup.appendChild(explanationDiv);

    // Suggestion (main)
    const suggestionValue = suggestions[0]?.value || suggestions[0];
    const suggestionDiv = document.createElement('div');
    suggestionDiv.className = 'grammar-main-suggestion';
    suggestionDiv.textContent = suggestionValue;
    suggestionDiv.onclick = () => {
      this.applySuggestion(word, suggestionValue);
      this.hideSuggestions();
    };
    popup.appendChild(suggestionDiv);

    // Options row
    const optionsRow = document.createElement('div');
    optionsRow.className = 'grammar-options-row';

    // Ignore button
    const ignoreBtn = document.createElement('button');
    ignoreBtn.textContent = 'Ignore';
    ignoreBtn.className = 'grammar-ignore-btn';
    ignoreBtn.onclick = () => this.hideSuggestions();
    optionsRow.appendChild(ignoreBtn);

    popup.appendChild(optionsRow);

    // Position popup
    const { top, left } = rect;
    popup.style.top = `${top + window.scrollY + 28}px`;
    popup.style.left = `${left + window.scrollX}px`;
    popup.style.display = 'block';
  }

  // Hide suggestions popup
  hideSuggestions() {
    this.suggestionPopup.style.display = 'none';
  }

  // Apply the selected suggestion
  applySuggestion(originalWord, suggestion) {
    const input = document.querySelector('#message-input');
    if (!input) return;
    const text = input.value;
    const newText = text.replace(originalWord, suggestion);
    input.value = newText;
  }

  // Create settings toggle button
  createSettingsToggle() {
    const toggle = document.createElement('div');
    toggle.className = 'grammar-toggle';
    toggle.innerHTML = `
      <label class="switch">
        <input type="checkbox" id="grammar-toggle">
        <span class="slider round"></span>
      </label>
      <span class="toggle-label">Grammar Check</span>
    `;
    return toggle;
  }

  // Highlight grammar errors in text
  highlightErrors(text, matches) {
    if (!matches || matches.length === 0) return text;
    let result = text;
    let offset = 0;
    matches.forEach(match => {
      const { offset: matchOffset, length, message, replacements } = match;
      const start = matchOffset + offset;
      const end = start + length;
      const span = document.createElement('span');
      span.className = 'grammar-error';
      span.title = message;
      span.textContent = result.slice(start, end);
      result = result.slice(0, start) + span.outerHTML + result.slice(end);
      offset += span.outerHTML.length - length;
    });
    return result;
  }
}

// Create and export a singleton instance
const grammarUI = new GrammarUI();
export default grammarUI; 