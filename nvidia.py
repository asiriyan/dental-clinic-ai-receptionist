import os
import json
import requests

API_KEY = os.getenv("NVIDIA_API_KEY")  # or paste "nvapi-..." directly for a quick test

resp = requests.get(
    "https://integrate.api.nvidia.com/v1/models",
    headers={"Authorization": f"Bearer {API_KEY}"},
    timeout=30,
)
resp.raise_for_status()
data = resp.json()

with open("nvidia_models.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

model_ids = [m["id"] for m in data["data"]]
print(f"Saved {len(model_ids)} models to nvidia_models.json")
print("\n".join(model_ids[:10]))




