import os
import re

files = [
    "frontend/src/components/MatchMap.tsx",
    "frontend/src/components/MatchScoreboard.tsx",
    "frontend/src/pages/DraftHelper.tsx",
    "frontend/src/pages/MatchDetail.tsx",
    "frontend/src/pages/Matches.tsx"
]

def fix_imports(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Just replace the whole import line with the specific used ones for each file.
    if "MatchMap.tsx" in filepath:
        content = content.replace("import { getHeroImage, getItemImage, getAbilityImage }", "import { getHeroImage }")
    elif "MatchScoreboard.tsx" in filepath:
        content = content.replace("import { getHeroImage, getItemImage, getAbilityImage }", "import { getHeroImage, getItemImage }")
    elif "DraftHelper.tsx" in filepath:
        content = content.replace("import { getHeroImage, getItemImage, getAbilityImage }", "import { getHeroImage }")
    elif "MatchDetail.tsx" in filepath:
        content = content.replace("import { getHeroImage, getItemImage, getAbilityImage }", "import { getHeroImage, getItemImage }")
    elif "Matches.tsx" in filepath:
        content = content.replace("import { getHeroImage, getItemImage, getAbilityImage }", "import { getHeroImage, getItemImage }")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
for f in files:
    fix_imports(f)
