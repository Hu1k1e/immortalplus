import os
import re
from glob import glob

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Replace import
    if "import { HEROES, getHeroImgUrl } from '../lib/heroes';" in content:
        content = content.replace("import { HEROES, getHeroImgUrl } from '../lib/heroes';",
                                  "import { HEROES } from '../lib/heroes';\nimport { getHeroImage, getItemImage, getAbilityImage } from '../lib/dota';")
    
    # In some places it might be DraftHelper.tsx which has its own getHeroImgUrl
    # Let's remove the inline getHeroImgUrl from DraftHelper
    content = re.sub(r'const getHeroImgUrl = \(imgName: string\) => {\n\s*return [^\n]+;\n\s*};\n*', '', content)

    # Replace getHeroImgUrl(
    content = content.replace("getHeroImgUrl(", "getHeroImage(")

    # Replace Item URLs
    # `https://cdn.akamai.steamstatic.com/apps/dota2/images/dota_react/items/${itemName.replace('item_', '')}.png` -> getItemImage(itemName)
    # Match patterns like: `https://cdn.akamai.steamstatic.com/apps/dota2/images/dota_react/items/${...}.png`
    content = re.sub(r'`https://cdn\.akamai\.steamstatic\.com/apps/dota2/images/dota_react/items/\$\{([^}]+)\}\.png`', r'getItemImage(\1)', content)

    # Hero URLs
    # `https://cdn.akamai.steamstatic.com/apps/dota2/images/dota_react/heroes/${...}.png` -> getHeroImage(...)
    content = re.sub(r'`https://cdn\.akamai\.steamstatic\.com/apps/dota2/images/dota_react/heroes/\$\{([^}]+)\}\.png`', r'getHeroImage(\1)', content)

    if content != original:
        # Also ensure we imported dota if we didn't match the specific string above
        if "getHeroImage" in content and "import { getHeroImage" not in content:
            # Let's just add it at the top
            content = "import { getHeroImage, getItemImage, getAbilityImage } from '../lib/dota';\n" + content

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Patched {filepath}")

if __name__ == '__main__':
    files = []
    files.extend(glob("frontend/src/pages/*.tsx"))
    files.extend(glob("frontend/src/components/*.tsx"))
    for f in files:
        patch_file(f)
