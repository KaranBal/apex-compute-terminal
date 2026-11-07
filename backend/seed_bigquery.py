"""Seeds the northam-ce-mlai-tpu:apex_compute_terminal BigQuery dataset with:
1. portfolio_and_candidates (37 AI Compute stocks across Sleeve 1, 2, 3)
2. supply_chain_layers (7 layers of the AI compute stack)
3. expert_panel_consensus (12 industry & investment experts)
4. sleeve3_contenders (5 sector contenders for the 'Next Micron/SK Hynix')
"""

import json
import os
from pathlib import Path
import subprocess
import tempfile

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "northam-ce-mlai-tpu")
DATASET_ID = os.environ.get("BIGQUERY_DATASET", "apex_compute_terminal")
SEED_PATH = Path(__file__).parent / "data" / "terminal_seed_data.json"


def seed_bq_tables():
    data = json.loads(SEED_PATH.read_text())
    tables = {
        "portfolio_and_candidates": data["stocks"],
        "supply_chain_layers": data["supply_chain_layers"],
        "expert_panel_consensus": data["expert_panel"],
        "sleeve3_contenders": data["sleeve3_contenders"],
        "portfolio_caps": data["portfolio_caps"],
        "catalyst_calendar": data["catalyst_calendar"],
    }

    env = os.environ.copy()
    env["PATH"] = f"{env.get('PATH', '')}:/Users/karansbal/google-cloud-sdk/bin:/opt/homebrew/bin"
    existing_metrics = env.get("CLOUDSDK_METRICS_ENVIRONMENT", "")
    env["CLOUDSDK_METRICS_ENVIRONMENT"] = f"{existing_metrics} datacloud.antigravity".strip()

    for table_name, rows in tables.items():
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as tmp:
            for r in rows:
                clean_row = {}
                for k, v in r.items():
                    if isinstance(v, (dict, list)):
                        clean_row[k] = json.dumps(v)
                    else:
                        clean_row[k] = v
                tmp.write(json.dumps(clean_row) + "\n")
            tmp_path = tmp.name

        cmd = [
            "bq",
            "load",
            "--project_id",
            PROJECT_ID,
            "--label",
            "datacloud:antigravity",
            "--replace",
            "--autodetect",
            "--source_format=NEWLINE_DELIMITED_JSON",
            f"{PROJECT_ID}:{DATASET_ID}.{table_name}",
            tmp_path,
        ]
        print(f"Loading {len(rows)} rows into {PROJECT_ID}:{DATASET_ID}.{table_name}...")
        res = subprocess.run(cmd, env=env, capture_output=True, text=True)
        os.unlink(tmp_path)
        if res.returncode != 0:
            print(f"Warning loading {table_name}: {res.stderr or res.stdout}")
        else:
            print(f"Successfully loaded {table_name}.")


if __name__ == "__main__":
    seed_bq_tables()
