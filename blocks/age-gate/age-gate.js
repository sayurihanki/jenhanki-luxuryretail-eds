// age-gate.js

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
  document.cookie = `${name}=${value || ''}${expires}; path=/`;
}

function getCookie(name) {
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i += 1) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

export default async function decorate(block) {
  const minAge = parseInt(block.dataset.minAge || '18', 10);
  const storageDuration = parseInt(block.dataset.storageDuration || '30', 10);
  const decisionKey = 'age_gate_decision';

  const decision = localStorage.getItem(decisionKey) || getCookie(decisionKey);

  if (decision === 'true') {
    return;
  }

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
      <input type="number" placeholder="${monthPlaceholder}" id="age-gate-month" aria-label="Month" min="1" max="12">
      <input type="number" placeholder="${dayPlaceholder}" id="age-gate-day" aria-label="Day" min="1" max="31">
      <input type="number" placeholder="${yearPlaceholder}" id="age-gate-year" aria-label="Year" min="1900" max="${new Date().getFullYear()}">
    </div>
    <button class="age-gate-button">${buttonText}</button>
    <p class="age-gate-error" style="display: none;"></p>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const monthInput = modal.querySelector('#age-gate-month');
  const dayInput = modal.querySelector('#age-gate-day');
  const yearInput = modal.querySelector('#age-gate-year');
  const submitButton = modal.querySelector('.age-gate-button');
  const errorElement = modal.querySelector('.age-gate-error');

  const inputs = [monthInput, dayInput, yearInput, submitButton];
  inputs[0].focus();

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const focusableElements = inputs;
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const currentFocus = document.activeElement;
      const currentIndex = focusableElements.indexOf(currentFocus);

      if (e.shiftKey && currentFocus === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && currentFocus === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  });

  submitButton.addEventListener('click', () => {
    const month = parseInt(monthInput.value, 10);
    const day = parseInt(dayInput.value, 10);
    const year = parseInt(yearInput.value, 10);

    if (month && day && year && month >= 1 && month <= 12 && day >= 1 && day <= 31 && year > 1900) {
      const dob = new Date(year, month - 1, day);
      if (calculateAge(dob) >= minAge) {
        localStorage.setItem(decisionKey, 'true');
        setCookie(decisionKey, 'true', storageDuration);
        document.body.removeChild(overlay);
        document.body.style.overflow = 'auto';
      } else {
        errorElement.textContent = errorMessage;
        errorElement.style.display = 'block';
      }
    } else {
      errorElement.textContent = 'Please enter a valid date.';
      errorElement.style.display = 'block';
    }
  });
}
