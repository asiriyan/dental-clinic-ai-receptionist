import os
import json
import time
import requests

API_KEY = os.getenv("NVIDIA_API_KEY")
URL = "https://integrate.api.nvidia.com/v1/chat/completions"
DELAY = 1.5            # seconds between calls
TIMEOUT = 60
RESULTS_FILE = "model_results.json"

# IDs containing these are almost never chat models, so skip them
SKIP_WORDS = ["embed", "rerank", "reward", "guard", "parse", "clip",
              "vila", "nvclip", "retriever", "tts", "asr", "whisper", "riva"]

with open("nvidia_models.json", encoding="utf-8") as f:
    all_ids = [m["id"] for m in json.load(f)["data"]]

candidates = [m for m in all_ids if not any(w in m.lower() for w in SKIP_WORDS)]
print(f"{len(all_ids)} total, {len(candidates)} to test")

# Resume from previous run if the results file exists
results = {}
if os.path.exists(RESULTS_FILE):
    with open(RESULTS_FILE, encoding="utf-8") as f:
        results = json.load(f)

def test_model(model_id):
    body = {
        "model": model_id,
        "messages": [{"role": "user", "content": "Say hi"}],
        "max_tokens": 5,
    }
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
    start = time.time()
    try:
        r = requests.post(URL, headers=headers, json=body, timeout=TIMEOUT)
        secs = round(time.time() - start, 2)
        if r.status_code == 200:
            text = r.json()["choices"][0]["message"].get("content", "")
            return {"status": "working", "seconds": secs, "reply": text}
        if r.status_code == 429:
            return {"status": "rate_limited", "seconds": secs}
        return {"status": "failed", "code": r.status_code, "error": r.text[:200]}
    except requests.exceptions.Timeout:
        return {"status": "timeout"}
    except Exception as e:
        return {"status": "error", "error": str(e)[:200]}

for i, model_id in enumerate(candidates, 1):
    if model_id in results and results[model_id]["status"] in ("working", "failed"):
        continue  # already tested
    res = test_model(model_id)
    if res["status"] == "rate_limited":
        time.sleep(20)          # back off and retry once
        res = test_model(model_id)
    results[model_id] = res
    print(f"[{i}/{len(candidates)}] {res['status']:<12} {model_id}")

    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    time.sleep(DELAY)

working = sorted(m for m, r in results.items() if r["status"] == "working")
with open("working_models.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(working))

print(f"\nDone. {len(working)} working models saved to working_models.txt")