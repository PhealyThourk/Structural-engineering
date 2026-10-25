## Python calculation backend

The steel member design calculator now sends its design inputs to a Python API. The HTML, CSS, and JavaScript remain the browser interface and report renderer; calculation and buckling reduction data processing run in `backend/app.py`.

### Run locally

From the repository root, install `backend/requirements.txt`, start the API with `uvicorn backend.app:app --reload --port 8001`, and serve `docs/assets/tools` with a local static web server. The page uses `http://127.0.0.1:8001` automatically when opened from localhost.

### Deploy the API

GitHub Pages serves static files and cannot run this Python API. Deploy the `backend` package on a Python web service that can access the repository's `docs/assets/tools/steel-section-database.json` and `steel-ltb-tables.json` files. Set `STEEL_API_CORS_ORIGINS` to the website origin. After deployment, set `window.STEEL_DESIGN_API_URL` in `docs/assets/tools/steel-member-design-api-config.js` to the API's HTTPS base URL. The page posts JSON to `/api/design-check`; `/health` is available for service checks.

The API uses FastAPI and Uvicorn. Their requirements are isolated in `backend/requirements.txt`; the existing MkDocs site requirements remain unchanged.
### Deploy with Render

The repository includes `render.yaml` for a free Render web service. Push the repository to GitHub, then create a Blueprint in Render from this repository and deploy the `steel-member-design-api` service. The blueprint installs `backend/requirements.txt`, starts Uvicorn on Render's assigned port, and permits requests from the configured GitHub Pages origin. After Render finishes deployment, check `<API_BASE_URL>/health`, then set `window.STEEL_DESIGN_API_URL` in `docs/assets/tools/steel-member-design-api-config.js` to the Render service base URL and publish the website. The base URL must not include `/api/design-check`.

If the deployment site requires authorization to connect to GitHub, complete that authorization in Render yourself. This grants Render access to the repository for deployment.