import json
import logging
from typing import Optional
from openai import AsyncOpenAI
import httpx
import re

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
K/D/A: {match_data.get('kills', 0)}/{match_data.get('deaths', 0)}/{match_data.get('assists', 0)}
CS at 10m: {analysis_result.get('cs_at_10', 0)}

Event Logs:
Item Purchases (seconds): {json.dumps((match_data.get('purchase_log') or [])[:10])} ...
Kills (seconds): {json.dumps((match_data.get('kills_log') or [])[:10])} ...

Rank Benchmarks for this role:
{json.dumps(analysis_result.get('rank_comparison', {}), indent=2)}

CRITICAL INSTRUCTIONS:
1. DO NOT include any conversational text, thought processes, or reasoning.
2. DO NOT use markdown backticks (e.g. ```json).
3. KEEP YOUR INSIGHTS EXTREMELY CONCISE. No long paragraphs! Use short bullet points of 1 sentence each.
4. YOU MUST RETURN ONLY THE RAW JSON OBJECT.

Your output must perfectly match this structure (very concise):
{{
    "mistakes_current_rank": ["Short point 1", "Short point 2"],
    "mistakes_target_rank": ["Short point 1"],
    "mistakes_pro_level": ["Short point 1"],
    "action_items": [
        {{
            "text": "Short actionable advice.",
            "category": "farming",
            "difficulty": "medium",
            "priority": 1,
            "timestamp": null
        }}
    ],
    "overall_summary": "One sentence summary."
}}
"""

        response = await client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a Dota 2 coach API. You output ONLY raw JSON. No conversational text whatsoever."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2500
        )
        
        content = response.choices[0].message.content.strip() if response.choices and response.choices[0].message.content else ""
        logger.info(f"Raw LLM output: {content}")
        
        if not content:
            raise ValueError("LLM returned an empty response")
            
        # Extract everything from the first { to the end
        match = re.search(r'\{.*', content, re.DOTALL)
        if match:
            json_str = match.group(0)
            try:
                result = json.loads(json_str)
                return result
            except json.decoder.JSONDecodeError as e:
                logger.error(f"LLM JSON Decode Error (Truncated?): {e}")
                
                # Try aggressive repair strategies for truncated JSON
                suffixes_to_try = [
                    '"]}', '"}', ']}', '}', '"]}]}', '}]}', '"}]}'
                ]
                
                for suffix in suffixes_to_try:
                    try:
                        return json.loads(json_str + suffix)
                    except:
                        pass
                
                # If all simple fixes fail, return what we can or raise
                raise ValueError(f"LLM response was severely truncated and could not be parsed.")
        else:
            raise ValueError(f"Could not find JSON object in LLM response: {content}")
        
    except Exception as e:
        logger.error(f"Failed to generate AI coaching: {e}", exc_info=True)
        # Raise so the frontend gets a 500 with a clean message
        raise ValueError(f"AI Error: {str(e)}")
