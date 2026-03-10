import os
import json
import base64
import httpx
from datetime import datetime, timezone
from groq import Groq


from fastapi import APIRouter, HTTPException, UploadFile, File
# NOTE: load_dotenv() is intentionally called only once in main.py at startup.

router = APIRouter(prefix="/meals", tags=["meals"])

# Initialize Groq client
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ---------------------------------------------------------------------------
# Constants — sourced entirely from environment variables, never hardcoded
# ---------------------------------------------------------------------------
USDA_API_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"

# Maximum accepted image payload in bytes (10 MB). Prevents memory exhaustion
# from oversized uploads before bytes are passed to the Gemini API.
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

# Minimum confidence score required to proceed with a food identification.
# Any food below this threshold triggers the low_confidence early-exit response.
CONFIDENCE_THRESHOLD = 0.55

# ---------------------------------------------------------------------------
# Glycemic Index lookup table
# ---------------------------------------------------------------------------
GI_LOOKUP: dict[str, int] = {
    # Rice & grains
    "basmati rice": 58, "white rice": 73, "brown rice": 55, "rice": 73,
    "chapati": 52, "roti": 52, "naan": 71, "paratha": 66, "puri": 74,
    "idli": 46, "dosa": 51, "upma": 65, "poha": 70, "bread": 75,
    "white bread": 75, "whole wheat bread": 69, "oats": 55, "quinoa": 53,
    # Lentils & legumes
    "dal": 22, "lentils": 22, "dal tadka": 22, "dal makhani": 30,
    "chana": 33, "chickpeas": 33, "rajma": 29, "kidney beans": 29,
    "moong dal": 31, "masoor dal": 31, "black beans": 30,
    # Vegetables
    "potato": 78, "aloo": 78, "sweet potato": 63, "carrot": 47,
    "spinach": 15, "palak": 15, "tomato": 15, "onion": 10,
    "cauliflower": 15, "gobi": 15, "broccoli": 15, "salad": 15,
    "cucumber": 15, "capsicum": 15, "mushroom": 15, "corn": 52,
    # Fruits
    "banana": 51, "apple": 36, "mango": 51, "orange": 43,
    "grapes": 46, "watermelon": 72, "papaya": 60, "pineapple": 66,
    "pomegranate": 35, "guava": 12, "strawberry": 41,
    # Dairy & protein
    "milk": 31, "curd": 36, "yogurt": 36, "paneer": 27,
    "egg": 0, "chicken": 0, "fish": 0, "mutton": 0,
    # Snacks & sweets
    "samosa": 65, "pakora": 60, "jalebi": 68, "halwa": 70,
    "kheer": 65, "ladoo": 65, "barfi": 65,
    # Other
    "tortilla": 52, "pasta": 49, "noodles": 53, "pizza": 60,
    "burger": 66, "sandwich": 70,
    # North Indian mains
    "butter chicken": 45, "murgh makhani": 45, "chicken curry": 45,
    "palak paneer": 30, "paneer butter masala": 45, "shahi paneer": 48,
    "paneer tikka masala": 45, "kadai paneer": 43, "matar paneer": 40,
    "aloo gobi": 62, "aloo matar": 65, "aloo palak": 52,
    "baingan bharta": 25, "mixed vegetable curry": 45, "bhindi masala": 20,
    "rajma chawal": 55, "chole": 33, "chole bhature": 65,
    "chole puri": 67, "sarson da saag": 25, "makki di roti": 59,
    # Rice dishes
    "biryani": 65, "chicken biryani": 65, "mutton biryani": 65,
    "veg biryani": 60, "pulao": 60, "jeera rice": 70,
    "khichdi": 50, "curd rice": 45, "lemon rice": 65,
    "tamarind rice": 65, "pongal": 55, "bisibelebath": 55,
    # Breads
    "kulcha": 68, "bhatura": 72, "luchi": 72,
    "missi roti": 45, "thepla": 48, "bajra roti": 41,
    "jowar roti": 43, "besan chilla": 40,
    # South Indian
    "sambhar": 30, "rasam": 25, "uttapam": 55,
    "medu vada": 55, "rava dosa": 65, "pesarattu": 40,
    "appam": 52, "puttu": 55, "kerala fish curry": 40,
    # Snacks & street food
    "pav bhaji": 68, "vada pav": 70, "bhel puri": 62,
    "pani puri": 65, "dahi puri": 60, "sev puri": 62,
    "aloo tikki": 70, "raj kachori": 65, "kachori": 66,
    "dhokla": 35, "khandvi": 32, "muthia": 38,
    "rava idli": 55,
    # Lentils & legumes (extended)
    "sambar": 30, "dal fry": 22, "dal baati": 55,
    "panchmel dal": 25, "chana dal": 33, "urad dal": 29,
    "moth dal": 32, "toor dal": 22,
    # Desserts & sweets
    "gulab jamun": 76, "rasgulla": 72,
    "gajar halwa": 68, "sooji halwa": 66, "moong dal halwa": 65,
    "payasam": 65, "phirni": 60, "shrikhand": 50,
    "lassi": 40, "sweet lassi": 55, "chaas": 25,
    # Breakfast
    "paratha with curd": 52, "aloo paratha": 66, "gobi paratha": 60,
    "paneer paratha": 55, "methi paratha": 45, "stuffed paratha": 60,
    "anda bhurji": 35, "masala omelette": 35,
    # Sindhi
    "sindhi kadhi": 35, "sindhi curry": 35, "sai bhaji": 20,
    "sindhi biryani": 63, "koki": 58, "sindhi kadhi chawal": 50,
    # Punjabi
    "maa ki dal": 30, "langarwali dal": 28, "amritsari kulcha": 65,
    "amritsari fish": 40, "tandoori chicken": 35, "seekh kebab": 30,
    "shami kebab": 35, "reshmi kebab": 35,
    # Bengali
    "macher jhol": 38, "aloo posto": 65, "shorshe ilish": 40,
    "doi maach": 38, "cholar dal": 33, "kosha mangsho": 40,
    "mishti doi": 55, "sandesh": 60,
    # Gujarati
    "undhiyu": 45, "gujarati dal": 28, "handvo": 40,
    "fafda": 55, "jalebi fafda": 62, "surti locho": 45,
    "gujarati kadhi": 30, "methi thepla": 45,
    # Maharashtrian
    "misal pav": 62, "puran poli": 68,
    "bharli vangi": 28, "sol kadhi": 20, "thalipeeth": 48,
    "sabudana khichdi": 85, "sabudana vada": 80,
    # Rajasthani
    "dal baati churma": 58, "gatte ki sabzi": 48, "laal maas": 40,
    "ker sangri": 30, "bajre ki khichdi": 45, "raab": 50,
    # South Indian extras
    "bisi bele bath": 55, "chettinad chicken": 42, "kerala prawn curry": 38,
    "avial": 35, "kootu": 38, "thoran": 30, "moru curry": 28,
    "hyderabadi biryani": 65, "haleem": 45,
    # Kadhi aliases — catches all Groq naming variations
    "kadhi": 35, "sindhi kadi": 35, "kadi": 35,
    "kadhi chawal": 45, "punjabi kadhi": 42, "pakora kadhi": 48,
    "kadhi pakora": 48,
    
    # Cold drinks & beverages
    'coca cola': 63, 'coke': 63, 'cola': 63, 'pepsi': 64,
    'sprite': 66, 'fanta': 68, 'mountain dew': 68,
    '7up': 66, 'limca': 60, 'thums up': 63,
    'red bull': 73, 'energy drink': 73,
    'orange juice': 50, 'apple juice': 44, 'mango juice': 55,
    'sugarcane juice': 43, 'coconut water': 54,
    'lemonade': 54, 'lassi': 40, 'buttermilk': 35,
    'milkshake': 45, 'cold coffee': 40,
    'tea': 0, 'coffee': 0, 'green tea': 0, 'water': 0, 'ice': 0,

    # Junk foods & fast food
    'burger': 70, 'hamburger': 70, 'cheeseburger': 70,
    'pizza': 60, 'french fries': 75, 'fries': 75,
    'hot dog': 52, 'sandwich': 53, 'wrap': 54,
    'chips': 56, 'nachos': 58, 'popcorn': 72,
    'chocolate': 49, 'ice cream': 61, 'gelato': 61,
    'donut': 76, 'muffin': 62, 'brownie': 55,
    'cookie': 55, 'wafer': 66, 'biscuit': 70,
    'maggi': 65, 'noodles': 58, 'pasta': 49,
    'fried chicken': 55, 'nuggets': 66, 'wings': 55,
    'cheesecake': 46, 'cake': 56, 'pastry': 59,
}

def get_gi(food_name: str) -> int | None:
    """Exact match first, then partial substring match (case-insensitive)."""
    name = food_name.lower().strip()
    # Exact match
    if name in GI_LOOKUP:
        return GI_LOOKUP[name]
    # Partial match — key is substring of food name, or food name is substring of key
    for key, gi in GI_LOOKUP.items():
        if key in name or name in key:
            return gi
    return None


# ---------------------------------------------------------------------------
# Local Indian nutrition fallback table
# Values per 100g serving. Sources: NIN India + ICMR dietary guidelines.
# ---------------------------------------------------------------------------
INDIAN_NUTRITION: dict[str, dict] = {
    "dal tadka":           {"calories": 105, "carbohydrates_g": 14, "protein_g": 6},
    "dal fry":             {"calories": 105, "carbohydrates_g": 14, "protein_g": 6},
    "dal makhani":         {"calories": 150, "carbohydrates_g": 16, "protein_g": 8},
    "moong dal":           {"calories": 104, "carbohydrates_g": 15, "protein_g": 7},
    "masoor dal":          {"calories": 116, "carbohydrates_g": 20, "protein_g": 9},
    "toor dal":            {"calories": 114, "carbohydrates_g": 19, "protein_g": 7},
    "chana dal":           {"calories": 164, "carbohydrates_g": 27, "protein_g": 9},
    "rajma":               {"calories": 144, "carbohydrates_g": 26, "protein_g": 9},
    "chole":               {"calories": 164, "carbohydrates_g": 27, "protein_g": 9},
    "palak paneer":        {"calories": 180, "carbohydrates_g": 8,  "protein_g": 9},
    "paneer butter masala":{"calories": 210, "carbohydrates_g": 10, "protein_g": 10},
    "shahi paneer":        {"calories": 220, "carbohydrates_g": 9,  "protein_g": 9},
    "kadai paneer":        {"calories": 195, "carbohydrates_g": 8,  "protein_g": 10},
    "matar paneer":        {"calories": 170, "carbohydrates_g": 12, "protein_g": 9},
    "paneer tikka masala": {"calories": 205, "carbohydrates_g": 9,  "protein_g": 11},
    "butter chicken":      {"calories": 165, "carbohydrates_g": 7,  "protein_g": 18},
    "chicken curry":       {"calories": 150, "carbohydrates_g": 5,  "protein_g": 18},
    "mutton curry":        {"calories": 190, "carbohydrates_g": 4,  "protein_g": 20},
    "fish curry":          {"calories": 130, "carbohydrates_g": 5,  "protein_g": 18},
    "chicken biryani":     {"calories": 200, "carbohydrates_g": 28, "protein_g": 14},
    "mutton biryani":      {"calories": 220, "carbohydrates_g": 27, "protein_g": 16},
    "veg biryani":         {"calories": 175, "carbohydrates_g": 32, "protein_g": 5},
    "biryani":             {"calories": 200, "carbohydrates_g": 28, "protein_g": 14},
    "pulao":               {"calories": 160, "carbohydrates_g": 30, "protein_g": 4},
    "khichdi":             {"calories": 130, "carbohydrates_g": 22, "protein_g": 5},
    "curd rice":           {"calories": 120, "carbohydrates_g": 20, "protein_g": 4},
    "aloo gobi":           {"calories": 95,  "carbohydrates_g": 14, "protein_g": 3},
    "aloo matar":          {"calories": 110, "carbohydrates_g": 18, "protein_g": 4},
    "aloo palak":          {"calories": 90,  "carbohydrates_g": 13, "protein_g": 3},
    "baingan bharta":      {"calories": 80,  "carbohydrates_g": 10, "protein_g": 3},
    "bhindi masala":       {"calories": 75,  "carbohydrates_g": 9,  "protein_g": 2},
    "sarson da saag":      {"calories": 85,  "carbohydrates_g": 9,  "protein_g": 4},
    "pav bhaji":           {"calories": 180, "carbohydrates_g": 28, "protein_g": 5},
    "chole bhature":       {"calories": 280, "carbohydrates_g": 38, "protein_g": 10},
    "aloo tikki":          {"calories": 165, "carbohydrates_g": 25, "protein_g": 3},
    "samosa":              {"calories": 260, "carbohydrates_g": 28, "protein_g": 5},
    "pakora":              {"calories": 220, "carbohydrates_g": 22, "protein_g": 6},
    "dhokla":              {"calories": 160, "carbohydrates_g": 25, "protein_g": 7},
    "idli":                {"calories": 58,  "carbohydrates_g": 12, "protein_g": 2},
    "dosa":                {"calories": 120, "carbohydrates_g": 22, "protein_g": 3},
    "uttapam":             {"calories": 130, "carbohydrates_g": 23, "protein_g": 4},
    "sambhar":             {"calories": 55,  "carbohydrates_g": 8,  "protein_g": 3},
    "rasam":               {"calories": 30,  "carbohydrates_g": 5,  "protein_g": 1},
    "medu vada":           {"calories": 180, "carbohydrates_g": 20, "protein_g": 5},
    "upma":                {"calories": 145, "carbohydrates_g": 22, "protein_g": 4},
    "poha":                {"calories": 130, "carbohydrates_g": 24, "protein_g": 3},
    "chapati":             {"calories": 104, "carbohydrates_g": 18, "protein_g": 3},
    "roti":                {"calories": 104, "carbohydrates_g": 18, "protein_g": 3},
    "naan":                {"calories": 260, "carbohydrates_g": 45, "protein_g": 8},
    "paratha":             {"calories": 200, "carbohydrates_g": 28, "protein_g": 5},
    "aloo paratha":        {"calories": 220, "carbohydrates_g": 32, "protein_g": 5},
    "gobi paratha":        {"calories": 210, "carbohydrates_g": 30, "protein_g": 5},
    "paneer paratha":      {"calories": 235, "carbohydrates_g": 28, "protein_g": 9},
    "puri":                {"calories": 210, "carbohydrates_g": 26, "protein_g": 4},
    "bhatura":             {"calories": 245, "carbohydrates_g": 32, "protein_g": 6},
    "kheer":               {"calories": 150, "carbohydrates_g": 24, "protein_g": 4},
    "gulab jamun":         {"calories": 175, "carbohydrates_g": 30, "protein_g": 3},
    "rasgulla":            {"calories": 106, "carbohydrates_g": 22, "protein_g": 2},
    "gajar halwa":         {"calories": 200, "carbohydrates_g": 28, "protein_g": 4},
    "lassi":               {"calories": 70,  "carbohydrates_g": 8,  "protein_g": 3},
    "chaas":               {"calories": 30,  "carbohydrates_g": 4,  "protein_g": 2},
    # Sindhi
    "sindhi kadhi":       {"calories": 95,  "carbohydrates_g": 12, "protein_g": 3},
    "sindhi curry":       {"calories": 95,  "carbohydrates_g": 12, "protein_g": 3},
    "sai bhaji":          {"calories": 70,  "carbohydrates_g": 8,  "protein_g": 4},
    "sindhi biryani":     {"calories": 210, "carbohydrates_g": 30, "protein_g": 12},
    "koki":               {"calories": 215, "carbohydrates_g": 30, "protein_g": 5},
    # Punjabi
    "maa ki dal":         {"calories": 130, "carbohydrates_g": 18, "protein_g": 8},
    "langarwali dal":     {"calories": 120, "carbohydrates_g": 17, "protein_g": 7},
    "amritsari kulcha":   {"calories": 270, "carbohydrates_g": 42, "protein_g": 8},
    "tandoori chicken":   {"calories": 165, "carbohydrates_g": 3,  "protein_g": 25},
    "seekh kebab":        {"calories": 185, "carbohydrates_g": 5,  "protein_g": 22},
    "shami kebab":        {"calories": 175, "carbohydrates_g": 8,  "protein_g": 18},
    # Bengali
    "macher jhol":        {"calories": 120, "carbohydrates_g": 5,  "protein_g": 16},
    "aloo posto":         {"calories": 140, "carbohydrates_g": 18, "protein_g": 3},
    "shorshe ilish":      {"calories": 195, "carbohydrates_g": 4,  "protein_g": 20},
    "doi maach":          {"calories": 130, "carbohydrates_g": 6,  "protein_g": 15},
    "cholar dal":         {"calories": 155, "carbohydrates_g": 25, "protein_g": 8},
    "kosha mangsho":      {"calories": 210, "carbohydrates_g": 6,  "protein_g": 22},
    "mishti doi":         {"calories": 120, "carbohydrates_g": 20, "protein_g": 4},
    # Gujarati
    "undhiyu":            {"calories": 130, "carbohydrates_g": 16, "protein_g": 5},
    "gujarati dal":       {"calories": 100, "carbohydrates_g": 14, "protein_g": 5},
    "handvo":             {"calories": 170, "carbohydrates_g": 24, "protein_g": 7},
    "gujarati kadhi":     {"calories": 75,  "carbohydrates_g": 9,  "protein_g": 3},
    "methi thepla":       {"calories": 180, "carbohydrates_g": 25, "protein_g": 5},
    # Maharashtrian
    "misal pav":          {"calories": 250, "carbohydrates_g": 38, "protein_g": 10},
    "puran poli":         {"calories": 230, "carbohydrates_g": 42, "protein_g": 6},
    "bharli vangi":       {"calories": 110, "carbohydrates_g": 12, "protein_g": 3},
    "sol kadhi":          {"calories": 35,  "carbohydrates_g": 5,  "protein_g": 1},
    "thalipeeth":         {"calories": 190, "carbohydrates_g": 28, "protein_g": 6},
    "sabudana khichdi":   {"calories": 220, "carbohydrates_g": 42, "protein_g": 3},
    "sabudana vada":      {"calories": 195, "carbohydrates_g": 35, "protein_g": 3},
    # Rajasthani
    "dal baati churma":   {"calories": 320, "carbohydrates_g": 45, "protein_g": 10},
    "gatte ki sabzi":     {"calories": 175, "carbohydrates_g": 20, "protein_g": 7},
    "laal maas":          {"calories": 215, "carbohydrates_g": 5,  "protein_g": 22},
    "ker sangri":         {"calories": 85,  "carbohydrates_g": 12, "protein_g": 3},
    "bajre ki khichdi":   {"calories": 140, "carbohydrates_g": 22, "protein_g": 5},
    # South Indian extras
    "bisi bele bath":     {"calories": 160, "carbohydrates_g": 28, "protein_g": 5},
    "chettinad chicken":  {"calories": 185, "carbohydrates_g": 6,  "protein_g": 22},
    "kerala prawn curry": {"calories": 145, "carbohydrates_g": 6,  "protein_g": 18},
    "avial":              {"calories": 105, "carbohydrates_g": 10, "protein_g": 3},
    "kootu":              {"calories": 115, "carbohydrates_g": 14, "protein_g": 4},
    "thoran":             {"calories": 90,  "carbohydrates_g": 8,  "protein_g": 3},
    "moru curry":         {"calories": 55,  "carbohydrates_g": 6,  "protein_g": 2},
    "hyderabadi biryani": {"calories": 215, "carbohydrates_g": 29, "protein_g": 14},
    "haleem":             {"calories": 195, "carbohydrates_g": 18, "protein_g": 16},
    'coca cola': {'calories': 42, 'carbohydrates_g': 10.6, 'protein_g': 0, 'glycemic_index': 63},
    'coke': {'calories': 42, 'carbohydrates_g': 10.6, 'protein_g': 0, 'glycemic_index': 63},
    'pepsi': {'calories': 41, 'carbohydrates_g': 10.4, 'protein_g': 0, 'glycemic_index': 64},
    'sprite': {'calories': 38, 'carbohydrates_g': 9.6, 'protein_g': 0, 'glycemic_index': 66},
    'ice': {'calories': 0, 'carbohydrates_g': 0, 'protein_g': 0, 'glycemic_index': 0},
    'water': {'calories': 0, 'carbohydrates_g': 0, 'protein_g': 0, 'glycemic_index': 0},
    'french fries': {'calories': 312, 'carbohydrates_g': 41, 'protein_g': 3.4, 'glycemic_index': 75},
    'burger': {'calories': 295, 'carbohydrates_g': 24, 'protein_g': 17, 'glycemic_index': 70},
    'pizza': {'calories': 266, 'carbohydrates_g': 33, 'protein_g': 11, 'glycemic_index': 60},
    'chips': {'calories': 536, 'carbohydrates_g': 53, 'protein_g': 7, 'glycemic_index': 56},
    'chocolate': {'calories': 546, 'carbohydrates_g': 60, 'protein_g': 5, 'glycemic_index': 49},
    'ice cream': {'calories': 207, 'carbohydrates_g': 24, 'protein_g': 3.5, 'glycemic_index': 61},
}

def get_indian_nutrition(food_name: str) -> dict | None:
    """Partial match lookup for Indian nutrition fallback table."""
    name = food_name.lower().strip()
    if name in INDIAN_NUTRITION:
        return INDIAN_NUTRITION[name]
    for key, data in INDIAN_NUTRITION.items():
        if key in name or name in key:
            return data
    return None

# ---------------------------------------------------------------------------
# Groq LLaMA vision food identification
# ---------------------------------------------------------------------------
def identify_foods_with_groq(image_bytes: bytes, mime_type: str) -> list:
    """
    Uses Groq LLaMA vision to identify foods
    in an image and return structured data.
    """
    # Convert image to base64
    image_b64 = base64.b64encode(image_bytes).decode('utf-8')

    # Call Groq vision API
    response = groq_client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{image_b64}"
                        }
                    },
                    {
                        "type": "text",
                        "text": """You are a food identification system. \
                        Analyze this image and return ONLY a valid \
                        JSON array with no markdown, no backticks, \
                        no explanation. Each item must have exactly:\
                        {\
                          \"food_name\": \"string\",\
                          \"confidence_score\": 0.0 to 1.0,\
                          \"portion_size_grams\": number\
                        }\
                        If anything is not food set non_food: true.\
                        Return ONLY the raw JSON array."""
                    }
                ]
            }
        ],
        temperature=0.1,
        max_tokens=500
    )

    # Parse and return the JSON response
    content = response.choices[0].message.content
    # Strip any accidental markdown
    content = content.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    return json.loads(content.strip())


# ---------------------------------------------------------------------------
# Helper: fetch_usda_nutrition
# ---------------------------------------------------------------------------

# Queries the USDA FoodData Central API for a single food name.
# Returns a dict with the fields we care about, or None if no match is found.
# Individual nutrient values are also None if USDA does not report them.
async def fetch_usda_nutrition(food_name: str) -> dict | None:
    # ── Early return for zero-calorie / non-food items ────────────────────────
    zero_cal = {'ice', 'water', 'ice cube', 'ice cubes', 'crushed ice'}
    if food_name.lower().strip() in zero_cal:
        return {
            "usda_food_id": None,
            "usda_description": food_name,
            "calories": 0,
            "carbohydrates_g": 0,
            "protein_g": 0,
            "glycemic_index": 0,
        }

    # ── Prefer local table when it has a complete entry (beverages, junk food) ─
    local = get_indian_nutrition(food_name)
    if local and local.get('glycemic_index') is not None and local.get('calories') is not None:
        return {
            "usda_food_id": None,
            "usda_description": f"Local data ({food_name})",
            "calories": local["calories"],
            "carbohydrates_g": local["carbohydrates_g"],
            "protein_g": local["protein_g"],
            "glycemic_index": local.get("glycemic_index") or get_gi(food_name),
        }

    api_key = os.getenv("USDA_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="USDA_API_KEY is not configured. Add it to your .env file.",
        )

    # Simplify compound names for better USDA matching
    usda_query = food_name.split()[0] if len(food_name.split()) > 1 else food_name

    params = {
        "query": usda_query,
        "api_key": api_key,
        "pageSize": 1,           # We only need the closest match
        "dataType": "Foundation,SR Legacy",  # Prefer authoritative datasets
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(USDA_API_URL, params=params)
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"USDA API returned an error: {e.response.status_code} — {e.response.text}",
        )
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach USDA API: {str(e)}")

    try:
        data = response.json()
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="USDA API returned a non-JSON response body (possible rate-limit or outage).",
        )

    foods = data.get("foods", [])

    # Per the rules: if USDA returns no match, try local Indian nutrition table
    if not foods:
        local = get_indian_nutrition(food_name)
        if local:
            return {
                "usda_food_id": None,
                "usda_description": f"Local data ({food_name})",
                "calories": local["calories"],
                "carbohydrates_g": local["carbohydrates_g"],
                "protein_g": local["protein_g"],
                "glycemic_index": get_gi(food_name),
            }
        return None

    # Extract nutrients from the first (best) result.
    # Use .get("nutrientName") instead of direct key access to tolerate
    # any malformed entries in the USDA payload without crashing.
    food_entry = foods[0]
    nutrients = {
        n.get("nutrientName"): n.get("value")
        for n in food_entry.get("foodNutrients", [])
        if n.get("nutrientName")  # Skip entries with no nutrientName key
    }

    # Map USDA nutrient names to our clean schema keys
    return {
        "usda_food_id": food_entry.get("fdcId"),
        "usda_description": food_entry.get("description"),
        # Calories: "Energy" in kcal — None if not present
        "calories": nutrients.get("Energy"),
        # Carbohydrates: "Carbohydrate, by difference"
        "carbohydrates_g": nutrients.get("Carbohydrate, by difference"),
        # Protein
        "protein_g": nutrients.get("Protein"),
        # GI is not provided by USDA — look it up from our local table (with partial matching).
        "glycemic_index": get_gi(food_name),
    }


# ---------------------------------------------------------------------------
# Helper: save_meal_to_supabase
# ---------------------------------------------------------------------------

# Persists the scan result to the meals table.
# Returns the inserted row on success. Raises HTTPException on failure.
# If Supabase is unavailable (e.g., missing credentials in dev), it logs and
# returns without crashing the response.
async def save_meal_to_supabase(
    user_id: str | None,
    photo_url: str | None,
    identified_foods: list[dict],
) -> dict | None:
    try:
        from db.supabase_client import supabase
    except ImportError:
        # Supabase SDK unavailable in this environment — skip persistence
        return None

    if supabase is None:
        # Client was not initialized (missing env vars) — skip persistence gracefully
        return None

    row = {
        "user_id": user_id,
        "photo_url": photo_url,
        "identified_foods": json.dumps(identified_foods),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        result = supabase.table("meals").insert(row).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        # TODO: Replace with structured logger once logging infrastructure exists
        print(f"[WARNING] Failed to save meal to Supabase: {e}")
        # Non-fatal: do not fail the API response if persistence fails
        return None


# ---------------------------------------------------------------------------
# Endpoint: POST /meals/scan
# ---------------------------------------------------------------------------

# Accepts a multipart image upload, identifies all foods using GPT-4o Vision,
# fetches USDA nutrition for each identified food, saves the result to Supabase,
# and returns a unified JSON response.
#
# Early-exit rules (per product spec):
#   - Any item with confidence < 0.85  → low_confidence response
#   - Any item flagged as non_food     → out_of_scope response
# ---------------------------------------------------------------------------
# Endpoint: GET /meals/scan-by-name
# ---------------------------------------------------------------------------
# Skips vision entirely. Used by the manual food entry flow when Groq returns
# low_confidence and the user types the food name themselves.
@router.get("/scan-by-name")
async def scan_by_name(food_name: str, user_id: str | None = None):
    nutrition = await fetch_usda_nutrition(food_name)
    gi = get_gi(food_name)
    food = {
        "food_name": food_name,
        "confidence_score": 1.0,
        "portion_size_grams": 100.0,
        "glycemic_index": gi,
        "nutrition": nutrition,
        "nutrition_data_available": nutrition is not None,
    }
    saved_row = await save_meal_to_supabase(
        user_id=user_id,
        photo_url=None,
        identified_foods=[food],
    )
    return {
        "status": "success",
        "meal_id": saved_row["id"] if saved_row else None,
        "foods_identified": 1,
        "foods": [food],
    }


# ---------------------------------------------------------------------------
# Endpoint: POST /meals/scan
@router.post("/scan")
async def scan_meal(
    image: UploadFile = File(..., description="JPEG or PNG image of the meal to scan"),
    user_id: str | None = None,
):
    # ── Step 1: Read and validate the uploaded image ──────────────────────
    try:
        image_bytes = await image.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {str(e)}")

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Guard against oversized uploads — reading all bytes into memory first,
    # then rejecting, is safe here because FastAPI streams uploads lazily and
    # MAX_IMAGE_SIZE_BYTES is small enough not to exhaust memory.
    if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large ({len(image_bytes) // (1024*1024)} MB). Maximum size is 10 MB.",
        )

    # Determine MIME type; default to image/jpeg if not provided
    mime_type = image.content_type or "image/jpeg"
    if mime_type not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported image type '{mime_type}'. Use JPEG, PNG, WebP, or GIF.",
        )

    # ── Step 2: Identify foods using Groq LLaMA vision ───────────────────
    try:
        identified_items = identify_foods_with_groq(image_bytes, mime_type)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Groq vision API error: {str(e)}",
        )

    if not isinstance(identified_items, list) or len(identified_items) == 0:
        raise HTTPException(
            status_code=422,
            detail="Groq vision returned an empty or invalid food list.",
        )

    # Guard: any non-food item in the image → immediate out_of_scope exit
    for item in identified_items:
        if item.get("non_food") is True:
            return {
                "status": "out_of_scope",
                "message": "I can only analyze food items. Please consult a doctor for medical queries.",
            }

    # Guard: any food with confidence below threshold → immediate low_confidence exit.
    # Coerce to float first — GPT occasionally returns confidence as a string ("0.9").
    for item in identified_items:
        raw_score = item.get("confidence_score", 0)
        try:
            score = float(raw_score)
        except (TypeError, ValueError):
            # If the score is completely unparseable, treat it as 0 (fail-safe)
            score = 0.0
        if score < CONFIDENCE_THRESHOLD:
            return {
                "status": "low_confidence",
                "message": "We couldn't clearly identify this food. Please type the name manually.",
            }

    # ── Step 3: Fetch USDA nutrition for each identified food ─────────────
    enriched_foods = []
    for item in identified_items:
        food_name = item.get("food_name", "").strip()

        if not food_name:
            # Skip malformed entries from the vision model
            continue

        try:
            nutrition = await fetch_usda_nutrition(food_name)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Unexpected error fetching USDA data for '{food_name}': {str(e)}",
            )

        # Validate portion_size_grams — GPT may return None or a non-numeric string.
        # Store null rather than crashing or storing garbage data.
        raw_portion = item.get("portion_size_grams")
        try:
            portion_size_grams = float(raw_portion) if raw_portion is not None else None
        except (TypeError, ValueError):
            portion_size_grams = None

        enriched_foods.append({
            "food_name": food_name,
            "confidence_score": float(item.get("confidence_score", 0)),
            "portion_size_grams": portion_size_grams,
            "glycemic_index": get_gi(food_name),
            # Per the rules: if USDA returned no match, nutrition is None and flagged
            "nutrition": nutrition,
            "nutrition_data_available": nutrition is not None,
        })

    # ── Step 4: Persist to Supabase meals table ───────────────────────────
    # photo_url is None because we received raw bytes; a future enhancement
    # TODO: Upload image bytes to Supabase Storage and store the returned URL
    saved_row = await save_meal_to_supabase(
        user_id=user_id,
        photo_url=None,
        identified_foods=enriched_foods,
    )

    # ── Step 5: Return clean unified response ─────────────────────────────
    return {
        "status": "success",
        "meal_id": saved_row["id"] if saved_row else None,
        "foods_identified": len(enriched_foods),
        "foods": enriched_foods,
    }
