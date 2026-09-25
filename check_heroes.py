import urllib.request
req = urllib.request.Request('https://www.opendota.com/assets/images/dota2/abilities/plus_high_five.png', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        with open('frontend/public/assets/images/dota2/abilities/plus_high_five.png', 'wb') as f:
            f.write(response.read())
        print('Downloaded plus_high_five')
except Exception as e:
    print('Failed:', e)
