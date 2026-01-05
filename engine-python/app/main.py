from fastapi import FastAPI

app = FastAPI(title="Competition Engine", version="0.1.0")

@app.get("/health")
def health():
    return {"status": "ok"}

# TODO: implement POST /v1/brackets/generate per contracts/engine.openapi.yaml
