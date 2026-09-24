import json
import logging
from typing import Optional
from openai import AsyncOpenAI
import httpx

from models import UserSettings

logger = logging.getLogger(__name__)

async def generate_ai_coaching(
    match_data: dict, 
    analysis_result: dict, 
    settings: UserSettings
) -> Optional[dict]:
    """
    Calls the configured OpenAI-compatible LLM to generate personalized coaching feedback.
    Returns a dictionary containing mistakes and action items.
    """
    if not settings.openai_api_key:
        logger.warning("No OpenAI API key configured. Skipping AI coaching.")
        return None

    client_args = {"api_key": settings.openai_api_key}
    if settings.openai_api_base:
        base_url = settings.openai_api_base.strip()
        if not base_url.startswith("http://") and not base_url.startswith("https://"):
            base_url = "https://" + base_url
        client_args["base_url"] = base_url
        # Bypass SSL verification for custom/self-hosted endpoints
        client_args["http_client"] = httpx.AsyncClient(verify=False)
        
    model_name = settings.openai_model or "gpt-4o"

    try:
        client = AsyncOpenAI(**client_args)
        
        # Prepare the context for the LLM
        prompt = f"""
You are Immortal+, an expert Dota 2 coach. Analyze the following match data and provide actionable feedback.
The player played {analysis_result['hero_name']} in the {analysis_result['role']} position.

Match Stats:
Duration: {match_data.get('duration', 0) // 60} minutes
K/D/A: {analysis_result['lategame_analysis']['final_kda']}
CS at 10m: {analysis_result['cs_at_10']}
GPM: {analysis_result['midgame_analysis']['gpm']}
XPM: {analysis_result['midgame_analysis']['xpm']}
Hero Damage: {analysis_result['midgame_analysis']['hero_damage']}
Tower Damage: {analysis_result['midgame_analysis']['tower_damage']}

Rank Benchmarks for this role:
{json.dumps(analysis_result['rank_comparison'], indent=2)}

Your task is to return a JSON object with exactly the following structure. Do not include markdown code block formatting (```json), just the raw JSON:
{{
    "mistakes_current_rank": [
        "Mistake 1 related to their current rank benchmarks",
        "Mistake 2..."
    ],
    "mistakes_target_rank": [
        "Mistake 1 related to the next rank up benchmarks",
        "Mistake 2..."
    ],
    "mistakes_pro_level": [
        "Mistake 1 related to pro level benchmarks (e.g. low CS compared to pros)"
    ],
    "action_items": [
        {{
            "text": "Specific, actionable advice (e.g. 'Practice pulling the easy camp at x:xx')",
            "category": "farming|fighting|vision|objectives|positioning",
            "difficulty": "easy|medium|hard",
            "priority": 1
        }}
    ],
    "overall_summary": "A 2-3 sentence encouraging summary of their performance."
}}
"""

        response = await client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are an expert Dota 2 coach. Always output valid raw JSON matching the requested schema. Do not use markdown backticks."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        
        content = response.choices[0].message.content.strip() if response.choices and response.choices[0].message.content else ""
        logger.info(f"Raw LLM output: {content}")
        
        if not content:
            raise ValueError("LLM returned an empty response")
            
        # Use regex to find the first { and last } to extract JSON
        import re
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            json_str = match.group(0)
            result = json.loads(json_str)
            return result
        else:
            raise ValueError(f"Could not find JSON object in LLM response: {content}")
        
    except Exception as e:
        logger.error(f"Failed to generate AI coaching: {e}", exc_info=True)
        return None
