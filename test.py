import json
import httpx

with open("settings.json") as f:
    settings = json.load(f)

token = settings.get("stratz_api_token")

query = """
query($matchId: Long!) {
  match(id: $matchId) {
    id
    players {
      steamAccountId
      playbackData {
        killEvents {
          time
        }
      }
    }
  }
}
"""

client = httpx.Client(headers={"Authorization": f"Bearer {token}"}, http2=False)
res = client.post("https://api.stratz.com/graphql", json={
    "query": query,
    "variables": {"matchId": 9014225712}
})
print("Status:", res.status_code)
print("Text:", res.text)
