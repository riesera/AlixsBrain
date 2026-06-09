# AlixsBrain V1 Prototype

A minimal External Brain prototype for capture, organization, and review.

## What this contains

- `app.py` — Flask backend with SQLite storage
- `brain.db` — created automatically on first run
- `templates/index.html` — lightweight browser interface
- `static/app.js` — interface behavior and API integration
- `static/style.css` — minimal styling

## Run locally

1. Create a Python environment
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the app:
   ```bash
   python app.py
   ```
4. Open `http://localhost:5000`

## V1 goals

- Capture raw entries
- Store items with categories: task, decision, waiting_on, reference, event
- Review and update item status
- Keep the first implementation minimal and easy to evolve
