import urllib.request
import json
req = urllib.request.Request('https://api.opendota.com/api/matches/9014225712', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        
        with open('backend/services/sync.py', 'r', encoding='utf-8') as f:
            sync_code = f.read()
            
        missing = []
        for key in data.keys():
            if key == 'players': continue
            s1 = '\"' + key + '\"'
            s2 = \"'\" + key + \"'\"
            if s1 not in sync_code and s2 not in sync_code:
                missing.append(key)
                
        print('Missing root keys from sync.py:')
        for key in sorted(missing):
            print(f'- {key}')
except Exception as e:
    print(e)
