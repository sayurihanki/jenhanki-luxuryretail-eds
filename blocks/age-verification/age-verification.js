export default function decorate(block) {
  // Check if age is already verified
  if (localStorage.getItem('age-verified') === 'true') {
    block.remove();
    return;
  }

  // extract content from the block
  // expecting standard block content:
  // <div>
  //   <div>Are you over 18?</div>
  //   <div>
  //      <p>Yes</p>
  //      <p>No</p>
  //   </div>
  // </div>
  const content = block.querySelector(':scope > div');
  const buttons = content ? content.querySelectorAll('div > p') : [];
  
  // Clean up existing content to rebuild the modal structure
  block.textContent = '';

  const overlay = document.createElement('div');
  overlay.className = 'age-verification-overlay';

  const modal = document.createElement('div');
  modal.className = 'age-verification-modal';

  const title = document.createElement('h2');
  title.textContent = content ? content.querySelector('div').textContent : 'Are you over 18?';
  
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'button-group';

  const yesButton = document.createElement('button');
  yesButton.textContent = buttons.length > 0 ? buttons[0].textContent : 'Yes';
  yesButton.className = 'verify-btn yes';
  yesButton.onclick = () => {
    localStorage.setItem('age-verified', 'true');
    block.remove();
    // Allow body scroll again
    document.body.style.overflow = '';
  };

  const noButton = document.createElement('button');
  noButton.textContent = buttons.length > 1 ? buttons[1].textContent : 'No';
  noButton.className = 'verify-btn no';
  noButton.onclick = () => {
      // Handle rejection - for now, maybe just alert or redirect
      // In a real scenario, this might act differently
      window.location.href = 'https://www.google.com';
  };

  buttonGroup.append(yesButton, noButton);
  modal.append(title, buttonGroup);
  overlay.append(modal);
  block.append(overlay);

  // Prevent scrolling on the body while the modal is open
  document.body.style.overflow = 'hidden';
}
