async function fetchItems() {
  const resp = await fetch('/api/items');
  return resp.json();
}

async function submitCapture(event) {
  event.preventDefault();
  const title = document.getElementById('title').value.trim();
  const rawText = document.getElementById('raw_text').value.trim();
  const kind = document.getElementById('kind').value;

  if (!title && !rawText) {
    alert('Please enter a title or some details.');
    return;
  }

  const payload = { title, raw_text: rawText, kind };
  await fetch('/api/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  document.getElementById('capture-form').reset();
  loadItems();
}

function getBoardId(kind) {
  const map = {
    task: 'tasks',
    decision: 'decisions',
    waiting_on: 'waiting_on',
    reference: 'reference',
  };
  return map[kind] || kind;
}

function createCard(item) {
  const card = document.createElement('div');
  card.className = 'card';

  const title = document.createElement('h4');
  title.textContent = item.title;
  card.appendChild(title);

  if (item.body) {
    const details = document.createElement('p');
    details.textContent = item.body;
    card.appendChild(details);
  }

  const meta = document.createElement('small');
  const statusLabel = item.status === 'open' ? 'Open' : item.status;
  meta.textContent = `Status: ${statusLabel} · Created: ${new Date(item.created_at).toLocaleString()}`;
  card.appendChild(meta);

  const button = document.createElement('button');
  button.textContent = item.status === 'open' ? 'Mark complete' : 'Reopen';
  button.className = item.status === 'open' ? '' : 'complete';
  button.addEventListener('click', async () => {
    const nextStatus = item.status === 'open' ? 'completed' : 'open';
    await fetch(`/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    loadItems();
  });
  card.appendChild(button);

  return card;
}

function setStatusMessage(text, isError = false) {
  const status = document.getElementById('status-message');
  if (!status) return;
  status.textContent = text;
  status.style.color = isError ? '#b91c1c' : '#1d4ed8';
  status.style.background = isError ? '#fef2f2' : '#eff6ff';
  status.style.borderColor = isError ? '#fecaca' : '#bfdbfe';
}

async function loadItems() {
  try {
    setStatusMessage('Loading items...');
    const items = await fetchItems();
    const kinds = ['task', 'decision', 'waiting_on', 'reference'];
    kinds.forEach(kind => {
      const board = document.getElementById(getBoardId(kind));
      if (!board) {
        console.warn(`Missing board for kind: ${kind}`);
        return;
      }
      board.innerHTML = '';
    });

    if (!items || items.length === 0) {
      setStatusMessage('No items found yet. Add something to see it appear.', false);
      return;
    }

    items.forEach(item => {
      const board = document.getElementById(getBoardId(item.kind));
      if (board) {
        board.appendChild(createCard(item));
      }
    });

    setStatusMessage(`Loaded ${items.length} item(s).`);
  } catch (error) {
    console.error('Error loading items', error);
    setStatusMessage('Error loading items. Open the browser console for details.', true);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const captureForm = document.getElementById('capture-form');
  if (captureForm) {
    captureForm.addEventListener('submit', submitCapture);
  }
  loadItems();
});
