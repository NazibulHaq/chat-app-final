// Always-visible countdown timer for both admins and users
function pad(n) { return n.toString().padStart(2, '0'); }

class CountdownTimer {
  constructor(container) {
    this.container = container;
    this.duration = 0; // seconds
    this.remaining = 0;
    this.interval = null;
    this.isRunning = false;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="timer-container">
        <input class="timer-input" id="timer-min" type="number" min="0" max="99" value="00"> :
        <input class="timer-input" id="timer-sec" type="number" min="0" max="59" value="00">
        <span id="timer-display">00:00</span>
        <button class="timer-btn" id="timer-start">Start</button>
        <button class="timer-btn" id="timer-pause" disabled>Pause</button>
        <button class="timer-btn" id="timer-reset">Reset</button>
      </div>
    `;
    this.display = this.container.querySelector('#timer-display');
    this.minInput = this.container.querySelector('#timer-min');
    this.secInput = this.container.querySelector('#timer-sec');
    this.startBtn = this.container.querySelector('#timer-start');
    this.pauseBtn = this.container.querySelector('#timer-pause');
    this.resetBtn = this.container.querySelector('#timer-reset');

    this.startBtn.onclick = () => this.start();
    this.pauseBtn.onclick = () => this.pause();
    this.resetBtn.onclick = () => this.reset();
    this.minInput.oninput = this.updateInputs.bind(this);
    this.secInput.oninput = this.updateInputs.bind(this);
    this.updateDisplay();
  }

  updateInputs() {
    let min = parseInt(this.minInput.value, 10) || 0;
    let sec = parseInt(this.secInput.value, 10) || 0;
    if (min < 0) min = 0;
    if (min > 99) min = 99;
    if (sec < 0) sec = 0;
    if (sec > 59) sec = 59;
    this.minInput.value = pad(min);
    this.secInput.value = pad(sec);
    this.duration = min * 60 + sec;
    this.remaining = this.duration;
    this.updateDisplay();
  }

  updateDisplay() {
    const min = Math.floor(this.remaining / 60);
    const sec = this.remaining % 60;
    this.display.textContent = `${pad(min)}:${pad(sec)}`;
  }

  start() {
    if (this.isRunning) return;
    this.updateInputs();
    if (this.remaining <= 0) return;
    this.isRunning = true;
    this.startBtn.disabled = true;
    this.pauseBtn.disabled = false;
    this.minInput.disabled = true;
    this.secInput.disabled = true;
    this.interval = setInterval(() => {
      if (this.remaining > 0) {
        this.remaining--;
        this.updateDisplay();
      } else {
        this.pause();
      }
    }, 1000);
  }

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.startBtn.disabled = false;
    this.pauseBtn.disabled = true;
    this.minInput.disabled = false;
    this.secInput.disabled = false;
    clearInterval(this.interval);
  }

  reset() {
    this.pause();
    this.updateInputs();
  }
}

// Insert timer above chat input on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const chatArea = document.getElementById('chat-area');
  if (chatArea) {
    const timerDiv = document.createElement('div');
    chatArea.insertBefore(timerDiv, chatArea.firstChild);
    new CountdownTimer(timerDiv);
  }
}); 