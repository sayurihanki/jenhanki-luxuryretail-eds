
// age-gate.js

/**
 * Age Gate overlay that fully replaces the block’s authored content.
 * Works with da.live label/value rows like:
 *   <div><div><p>data-min-age</p></div><div><p>18</p></div></div>
 * Also supports data-* attributes if you use UE later.
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

/* trap focus inside the dialog */
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

/* ---------- config readers ---------- */

/** Returns the row <div> elements directly under the block
 *  (your DOM: multiple rows, not a single wrapper). */
function getRows(block) {
  // direct children that are <div> rows
  return Array.from(block.querySelectorAll(':scope > div'));
}

/** Reads text content from a cell that may wrap content in <p> tags. */
function cellText(cell) {
  // Prefer the first <p>, fallback to whole cell text
  const p = cell.querySelector('p');
  return (p ? p.textContent : cell.textContent || '').trim();
}

/** Reads config from dataset and/or label/value rows. */
function readConfig(block) {
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

  // Parse label/value rows (as in your snippet)
  const rows = getRows(block);
  rows.forEach((row) => {
    const cells = Array.from(row.children);
    if (cells.length >= 2) {
      const key = cellText(cells[0]).toLowerCase();
      const val = cellText(cells[1]);
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

  // Read config from dataset or rows (matches your DOM)
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

  // Build overlay UI attached to BODY (so we don't depend on block visibility)
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

  // Append to BODY (not inside the block)
  document.body.appendChild(overlay);

  // Lock page scroll while overlay is open
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

  // Keep overlay until decision; ESC does not close
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

      // Guard invalid dates (e.g., 31 Feb)
      if (dob.getMonth() !== (month - 1) || dob.getDate() !== day || dob.getFullYear() !== year) {
        showError('Please enter a valid date.');
        return;
      }

      if (calculateAge(dob) >= minAge) {
        // Persist decision (localStorage + cookie)
        localStorage.setItem(DECISION_KEY, 'true');
        setCookie(DECISION_KEY, 'true', storageDuration);

        // Remove block and overlay, restore scroll
        block.remove();
        overlay.remove();
        document.body.style.overflow = previousOverflow || '';
      } else {
        showError(errorMessage);
      }
    } else {
      showError('Please enter a valid date.');
    }
  });
}
``