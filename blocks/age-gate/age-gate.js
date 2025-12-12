
// age-gate.js

/**
 * Ensures the Age Gate renders ONLY as an overlay and underlying block content
 * is never visible. If verified, the block is removed immediately.
 *
 * Data attributes supported on the block:
 * - data-min-age (default 18)
 * - data-storage-duration (days for cookie, default 30)
 * - data-title, data-message
 * - data-month-placeholder, data-day-placeholder, data-year-placeholder
 * - data-button-text
 * - data-error-message
 */

const DECISION_KEY = 'age_gate_decision';

function calculateAge(dob) {
  const diff = Date.now() - dob.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

function setCookie(name, value, days) {
  let expires = '';
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = `; expires=${date.toUTCString()}`;
  }
  document.cookie = `${name}=${value || ''}${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i += 1) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
  }
  return null;
}

/* Focus trap for accessibility */
function trapFocus(container, focusables) {
  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const current = document.activeElement;
    const goingBack = e.shiftKey;

    if (goingBack && current === first) {
      e.preventDefault();
      last.focus();
    } else if (!goingBack && current === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

export default async function decorate(block) {
  // Read config from data attributes with sensible defaults
  const minAge = parseInt(block.dataset.minAge || '18', 10);
  const storageDuration = parseInt(block.dataset.storageDuration || '30', 10);

  const decision = localStorage.getItem(DECISION_KEY) || getCookie(DECISION_KEY);

  // 1) If already verified, remove the block immediately (overlay never shows)
  if (decision === 'true') {
    block.remove();
    return;
  }

  // 2) Prevent any authored content from appearing
  //    If you want to keep authored text for SEO, you can move it into a
  //    visually-hidden wrapper before clearing; here we fully clear for safety.
  block.innerHTML = '';

  // 3) Build overlay UI
  const title = block.dataset.title || 'Age Verification';
  const message = block.dataset.message || 'Please enter your date of birth to continue.';
  const monthPlaceholder = block.dataset.monthPlaceholder || 'MM';
  const dayPlaceholder = block.dataset.dayPlaceholder || 'DD';
  const yearPlaceholder = block.dataset.yearPlaceholder || 'YYYY';
  const buttonText = block.dataset.buttonText || 'Submit';
  const errorMessage = block.dataset.errorMessage || `You must be at least ${minAge} years old to view this content.`;

  const overlay = document.createElement('div');
  overlay.className = 'age-gate-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'age-gate-title');

  const modal = document.createElement('div');
  modal.className = 'age-gate-modal';
  modal.innerHTML = `
    <h2 id="age-gate-title">${title}</h2>
    <p>${message}</p>
    <div class="age-gate-form">
      <input type="number" placeholder="${monthPlaceholder}" id="age-gate-month" aria-label="Month" min="1" max="12" inputmode="numeric">
      <input type="number" placeholder="${dayPlaceholder}" id="age-gate-day" aria-label="Day" min="1" max="31" inputmode="numeric">
      <input type="number" placeholder="${yearPlaceholder}" id="age-gate-year" aria-label="Year" min="1900" max="${new Date().getFullYear()}" inputmode="numeric">
    </div>
    <button class="age-gate-button" type="button">${buttonText}</button>
    <p class="age-gate-error" style="display: none;"></p>
  `;

  overlay.appendChild(modal);
  // Append overlay inside the block (EDS convention), then reveal the block.
  block.appendChild(overlay);
  block.style.display = ''; // show the overlay

  // Disable page scroll while modal is open
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  // 4) Wire events & accessibility
  const monthInput = modal.querySelector('#age-gate-month');
  const dayInput = modal.querySelector('#age-gate-day');
  const yearInput = modal.querySelector('#age-gate-year');
  const submitButton = modal.querySelector('.age-gate-button');
  const errorElement = modal.querySelector('.age-gate-error');

  const focusables = [monthInput, dayInput, yearInput, submitButton];
  trapFocus(overlay, focusables);
  // initial focus
  setTimeout(() => monthInput.focus(), 0);

  // Close prevention: keep overlay until a valid decision is made
  overlay.addEventListener('keydown', (e) => {
    // Prevent ESC from closing; you may allow it if you want a soft exit
    if (e.key === 'Escape') {
      e.preventDefault();
    }
  });

  function showError(text) {
    errorElement.textContent = text;
    errorElement.style.display = 'block';
  }

  function clearError() {
    errorElement.textContent = '';
    errorElement.style.display = 'none';
  }

  submitButton.addEventListener('click', () => {
    clearError();

    const month = parseInt(monthInput.value, 10);
    const day = parseInt(dayInput.value, 10);
    const year = parseInt(yearInput.value, 10);

    // Basic validation
    if (
      Number.isInteger(month) && Number.isInteger(day) && Number.isInteger(year) &&
      month >= 1 && month <= 12 &&
      day >= 1 && day <= 31 &&
      year > 1900 && year <= new Date().getFullYear()
    ) {
      const dob = new Date(year, month - 1, day);

      // Guard against invalid dates like 31 Feb
      if (dob.getMonth() !== month - 1 || dob.getDate() !== day || dob.getFullYear() !== year) {
        showError('Please enter a valid date.');
        return;
      }

      if (calculateAge(dob) >= minAge) {
        // Persist decision in both storage mechanisms for robustness
        localStorage.setItem(DECISION_KEY, 'true');
        setCookie(DECISION_KEY, 'true', storageDuration);

        // Remove block (overlay + any hidden content) and restore scroll
        block.remove();
        document.body.style.overflow = previousOverflow || '';
      } else {
        showError(errorMessage);
      }
      } else {
        showError('Please enter a valid date.');
      }
    });
  }