import urllib.request
import json
req = urllib.request.Request('https://api.opendota.com/api/matches/9014225712', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        
    with open('frontend/src/lib/constants/abilities.json', 'r', encoding='utf-8') as f:
        abilities = json.load(f)
        
    special = ['ability_lamp_use', 'ability_pluck_famango', 'twin_gate_portal_warp', 'ability_capture', 'plus_high_five']
    
    missing = set()
    for p in data['players']:
        for ab in p.get('ability_uses', {}).keys():
            if ab.startswith('item_'): continue
            if ab.startswith('special_bonus_'): continue
            if ab.startswith('attribute_bonus'): continue
            if ab not in abilities and ab not in special:
                missing.add(ab)
                
    print('Missing abilities from abilities.json:')
    print(missing)
except Exception as e:
    print(e)
