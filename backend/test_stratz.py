import sqlite3
import httpx

conn = sqlite3.connect('data/immortal.db')
cursor = conn.cursor()
cursor.execute('SELECT stratz_api_token FROM user_settings LIMIT 1')
token = cursor.fetchone()[0]
conn.close()

query = """
query($matchId: Long!) {
  match(id: $matchId) {
    id
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
