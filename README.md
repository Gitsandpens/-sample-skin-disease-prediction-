# Skin Disease Prediction — Federated Learning Web App

An academic mini-project: a web app that predicts skin lesion type from an
uploaded image, using a CNN trained with **federated learning** (FedAvg)
across simulated hospital clients, plus a small general diet-plan feature.

```
skin-disease-fl/
├── backend/
│   ├── app.py                     Flask REST API
│   ├── requirements.txt
│   ├── models/
│   │   └── cnn_model.py           CNN architecture + class labels
│   ├── federated/
│   │   ├── fed_client.py          FL client: local training on a data shard
│   │   ├── fed_server.py          FL server: FedAvg aggregation
│   │   └── simulate_training.py   Runs the full federated training loop
│   ├── database/
│   │   └── db_models.py           SQLAlchemy models (User, Prediction, DietProfile)
│   ├── utils/
│   │   └── diet_plan.py           BMI-based diet suggestions
│   └── saved_models/              global_model.pth is written here
└── frontend/
    ├── index.html
    ├── style.css
    ├── script.js
    └── config.js                  Set API_BASE_URL here
```

## How the federated learning works

1. `fed_server.py` holds a **global model** and starts each round by sending
   its current weights to every client.
2. `fed_client.py` represents one hospital. It trains a **local copy** of
   the model on its own private image shard for a few epochs. Raw images
   never leave the client.
3. Each client sends back only its updated **weights** (not data) plus how
   many samples it trained on.
4. The server combines all client weights with **FedAvg** — a weighted
   average by sample count — to produce the next global model.
5. Repeat for N rounds. `simulate_training.py` orchestrates steps 1–4 and
   saves the final model to `backend/saved_models/global_model.pth`.

`app.py` loads that saved global model and serves predictions over HTTP —
it is not itself part of training, it just uses the trained result.

### About the data
`simulate_training.py` ships with a **synthetic data generator** so the
whole pipeline runs immediately with zero setup and proves the FL
mechanics work end to end. A model trained on synthetic noise won't give
medically meaningful predictions, though.

For a real submission, download the [HAM10000 dataset](https://doi.org/10.7910/DVN/DBW86T)
(10,015 labeled dermatoscopic images across the 7 classes already used in
`cnn_model.py`), split it into N folders (one per simulated hospital) to
mimic real siloed hospital data, and fill in `build_real_client_data()` in
`simulate_training.py` (a working stub with the expected folder layout is
already there).

## Setup

### 1. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Train the federated model (writes saved_models/global_model.pth)
python -m federated.simulate_training

# Start the API (http://localhost:5000)
python app.py
```
The SQLite database (`skin_disease.db`) is created automatically on first
run — no separate database install needed.

### 2. Frontend
The frontend is static HTML/CSS/JS — no build step. Just serve the folder:
```bash
cd frontend
python -m http.server 8080
```
Open `http://localhost:8080`. If your backend runs somewhere other than
`localhost:5000`, update `API_BASE_URL` in `frontend/config.js`.

## API summary
| Method | Endpoint              | Purpose                              |
|--------|------------------------|---------------------------------------|
| POST   | `/api/auth/register`  | Create an account                     |
| POST   | `/api/auth/login`     | Log in                                |
| POST   | `/api/predict`        | Upload an image, get a prediction     |
| GET    | `/api/history/<id>`   | A user's past predictions             |
| POST   | `/api/diet`           | BMI-based diet plan suggestion        |
| GET    | `/api/classes`        | List of disease classes recognized    |
| GET    | `/api/health`         | Health check                          |

## Notes for your report
- Federated learning here means multiple **clients** (simulated hospitals)
  each hold private data and train locally; only **model weights** are
  centralized and averaged (**FedAvg**), never raw patient images — this is
  the core privacy-preserving property worth highlighting in a mini-project
  writeup.
- Swap `NUM_CLIENTS`, `NUM_ROUNDS`, and `LOCAL_EPOCHS` in
  `simulate_training.py` to experiment with how federated averaging
  behaves under different client counts/rounds — good material for a
  results/graphs section.
- This is a student project demo, not a certified diagnostic tool; the
  frontend and API responses include a disclaimer accordingly.
