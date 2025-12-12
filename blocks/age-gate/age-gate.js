
// age-gate.js

/**
 * Age Gate overlay that fully replaces the block’s authored content.
 * Supports both:
 *  - data-* attributes on the block (UE/Crosswalk), and
 *  - label/value rows authored in documents (da.live).
 *
 * Label/value keys (case-insensitive):
 *  - data-min-age
 *  - data-storage-duration
 *  - data-title
 *  - data-message
 *  - data-month-placeholder
 *  - data-day-placeholder
 *  - data-year-placeholder
 *  - data-button-text
 *  - data-error-message
 */

const DECISION_KEY = 'age_gate_decision';

/* ---------- utilities ---------- */

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

/* Trap focus inside the dialog for accessibility */
function trapFocus(container, focusables) {
  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const back = e.shiftKey;
    const active = document.activeElement;

    if (back && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!back && active === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

/**
 * Read config from:
 * 1) block.dataset (if present)
 * 2) label/value rows inside the block (da.live)
 */
function readConfig(block) {
  // Start with dataset values
  const cfg = {
    minAge: block.dataset.minAge,
    storageDuration: block.dataset.storageDuration,
    title: block.dataset.title,
    message: block.dataset.message,
    monthPlaceholder: block.dataset.monthPlaceholder,
    dayPlaceholder: block.dataset.dayPlaceholder,
    yearPlaceholder: block.dataset.yearPlaceholder,
    buttonText: block.dataset.buttonText,
    errorMessage: block.dataset.errorMessage,
  };

  // If some are missing, parse label/value rows:
  const rows = [...block.children];
  if (rows.length > 0) {
    rows.forEach((row) => {
      const cells = [...row.children];
      if (cells.length >= 2) {
        const key = cells[0].textContent?.trim().toLowerCase();
        const val = cells[1].textContent?.trim();

        switch (key) {
          case 'data-min-age': cfg.minAge ??= val; break;
          case 'data-storage-duration': cfg.storageDuration ??= val; break;
          case 'data-title': cfg.title ??= val; break;
          case 'data-message': cfg.message ??= val; break;
          case 'data-month-placeholder': cfg.monthPlaceholder ??= val; break;
          case 'data-day-placeholder': cfg.dayPlaceholder ??= val; break;
          case 'data-year-placeholder': cfg.yearPlaceholder ??= val; break;
          case 'data-button-text': cfg.buttonText ??= val; break;
          case 'data-error-message': cfg.errorMessage ??= val; break;
          default: break;
        }
      }
    });
  }

  // Defaults
  const minAge = parseInt(cfg.minAge || '18', 10);
  return {
    minAge,
    storageDuration: parseInt(cfg.storageDuration || '30', 10),
    title: cfg.title || 'Age Verification',
    message: cfg.message || 'Please enter your date of birth to continue.',
    monthPlaceholder: cfg.monthPlaceholder || 'MM',
    dayPlaceholder: cfg.dayPlaceholder || 'DD',
    yearPlaceholder: cfg.yearPlaceholder || 'YYYY',
    buttonText: cfg.buttonText || 'Submit',
    errorMessage: cfg.errorMessage || `You must be at least ${minAge} years old to view this content.`,
  };
}

/* ---------- main ---------- */

export default async function decorate(block) {
  const decision = localStorage.getItem(DECISION_KEY) || getCookie(DECISION_KEY);

  // If already verified, remove block (no overlay)
  if (decision === 'true') {
    block.remove();
    return;
  }

  // Read config from dataset or rows
  const {
    minAge,
    storageDuration,
    title,
    message,
    monthPlaceholder,
    dayPlaceholder,
    yearPlaceholder,
    buttonText,
    errorMessage,
  } = readConfig(block);

  // Fully remove authored content to ensure nothing is visible underneath
  block.innerHTML = '';

  // Build overlay UI
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
  block.appendChild(overlay);

  // IMPORTANT: explicitly make the block visible (override CSS "display:none")
  block.classList.add('age-gate--active');
  block.style.display = 'block'; // extra safety across environments

  // Lock body scroll while overlay is open
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  // Accessibility wiring
  const monthInput = modal.querySelector('#age-gate-month');
  const dayInput = modal.querySelector('#age-gate-day');
  const yearInput = modal.querySelector('#age-gate-year');
  const submitButton = modal.querySelector('.age-gate-button');
  const errorElement = modal.querySelector('.age-gate-error');

  const focusables = [monthInput, dayInput, yearInput, submitButton];
  trapFocus(overlay, focusables);
  setTimeout(() => monthInput.focus(), 0);

  // Keep overlay until a valid decision; ESC does not close
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') e.preventDefault();
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

      // Guard invalid calendar dates (e.g., 31 Feb)
      if (dob.getMonth() !== (month - 1) || dob.getDate() !== day || dob.getFullYear() !== year) {
        showError('Please enter a valid date.');
        return;
      }

      if (calculateAge(dob) >= minAge) {
        // Persist decision (localStorage + cookie)
        localStorage.setItem(DECISION_KEY, 'true');
        setCookie(DECISION_KEY, 'true', storageDuration);

        // Remove entire block and restore scroll
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
