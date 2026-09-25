import requests
import json
import os

def fetch_and_save(url, output_path):
    print(f"Fetching {url}...")
    response = requests.get(url)
    if response.status_code == 200:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(response.json(), f, indent=2)
        print(f"Saved to {output_path}")
    else:
        print(f"Failed to fetch {url}")

if __name__ == '__main__':
    base_dir = "frontend/src/lib/constants"
    
    fetch_and_save("https://api.opendota.com/api/constants/heroes", f"{base_dir}/heroes.json")
    fetch_and_save("https://api.opendota.com/api/constants/items", f"{base_dir}/items.json")
    fetch_and_save("https://api.opendota.com/api/constants/abilities", f"{base_dir}/abilities.json")
