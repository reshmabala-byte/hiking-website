"""
WhatsApp chat parser for the Kananaskis/ABC hiking group.
Extracts: past hikes, upcoming trips, gear lists, buy recommendations, user tips.
Output: trails.json
"""

import re
import json
from datetime import datetime
from pathlib import Path

# ─────────────────────────────────────────────
# 1. PARSE WHATSAPP FORMAT → list of messages
# ─────────────────────────────────────────────
TIMESTAMP_RE = re.compile(
    r'^(\d{1,2}/\d{1,2}/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap][Mm])?)\s+-\s+'
)

def parse_chat(filepath: str) -> list[dict]:
    """Return a list of {date, time, author, text} dicts."""
    messages = []
    current = None

    with open(filepath, encoding="utf-8") as f:
        for raw in f:
            line = raw.rstrip("\n")
            m = TIMESTAMP_RE.match(line)
            if m:
                if current:
                    messages.append(current)
                rest = line[m.end():]
                # Split "Author: text" (system messages have no colon-author)
                if ": " in rest:
                    author, text = rest.split(": ", 1)
                else:
                    author, text = "SYSTEM", rest
                current = {
                    "date": m.group(1),
                    "time": m.group(2),
                    "author": author.strip(),
                    "text": text.strip(),
                }
            else:
                # Continuation of previous message
                if current:
                    current["text"] += "\n" + line
    if current:
        messages.append(current)

    # Drop pure system messages and empty/media-only messages
    filtered = []
    system_patterns = [
        r"Messages and calls are end-to-end encrypted",
        r"You created this group",
        r"added .+",
        r"removed .+",
        r"changed the group",
        r"pinned a message",
        r"security code",
        r"<Media omitted>",
        r"This message was deleted",
        r"This message was edited",
        r"You deleted this message",
        r"You removed .+",
        r"You added .+",
    ]
    sys_re = re.compile("|".join(system_patterns), re.I)
    for msg in messages:
        if msg["author"] == "SYSTEM":
            continue
        t = msg["text"].strip()
        if not t or sys_re.fullmatch(t):
            continue
        # Drop if text is only a URL with no other content
        if re.fullmatch(r"https?://\S+", t):
            continue
        filtered.append(msg)
    return filtered


# ─────────────────────────────────────────────
# 2. STRUCTURED DATA  (curated from chat reads)
# ─────────────────────────────────────────────

PAST_HIKES = [
    {
        "name": "Machu Picchu Trek",
        "location": "Machu Picchu, Peru",
        "status": "completed",
        "dates": {"approx": "Before December 2023"},
        "elevation_ft": 14000,
        "notes": (
            "Group completed the Inca Trail to Machu Picchu. Max elevation ~14,000 ft. "
            "Altitude medicine (Diamox) was taken. Used as benchmark for ABC preparation. "
            "T-shirts with trail distances were souvenirs from Alpaca."
        ),
        "participants": ["Bala Ravindran", "Binoj Kitchu", "Others"],
        "training_value": "High – confirmed ability to reach 14k ft with medication",
    },
    {
        "name": "Havasupai Falls Backpacking Trip",
        "location": "Havasupai, Grand Canyon, Arizona, USA",
        "status": "completed",
        "dates": {"approx": "Late March / Early April 2024"},
        "duration_days": 4,
        "daily_miles": 11,
        "notes": (
            "4-day trip averaging 11 miles per day. Extremely beautiful. "
            "Mule service used to carry heavy gear. Very scenic waterfalls."
        ),
        "participants": ["Bala Ravindran", "Others"],
    },
    {
        "name": "Flagstaff Training Hikes (Humphreys, Elden, Kendrick)",
        "location": "Flagstaff, Arizona, USA",
        "status": "completed",
        "dates": {"start": "2024-07-26", "end": "2024-07-28"},
        "duration_days": 3,
        "peaks": [
            {"name": "Mount Elden", "miles_rt": 5.15, "elevation_gain_ft": 2400,
             "notes": "Start from main parking lot, summit and back. Lung buster."},
            {"name": "Humphreys Peak", "elevation_ft": 12800,
             "notes": "Highest peak in AZ. Slow above 11k ft. Saddle section is very challenging."},
            {"name": "Kendrick Peak", "notes": "Hard trail, ~10 miles, ~2500 ft gain."},
        ],
        "daily_miles_avg": 10,
        "daily_elevation_gain_ft": 2500,
        "accommodation": "Airbnb, $928 for 2 nights",
        "notes": (
            "Training trip specifically to prepare for ABC Nepal. "
            "All trails rated Hard. Max elevation 12,800 ft at Humphreys – comparable to ABC's 13,750 ft. "
            "Diamox available for anyone feeling altitude effects. "
            "Participants: Bala, Kannan, Srikumar, Sam Raja, Binoj (flew in from out of town), Giridhar (post-surgery, limited)."
        ),
        "participants": ["Bala Ravindran", "Kannan Ramachandran", "Srikumar Nambiar",
                         "Sam Raja", "Binoj Kitchu", "Giridhar Ragnar"],
    },
    {
        "name": "Boundary Waters Backpacking Canoe Trip",
        "location": "Boundary Waters Canoe Area, Minnesota, USA",
        "status": "completed",
        "dates": {"approx": "August 22–25, 2024"},
        "duration_days": 4,
        "notes": (
            "Backpacking + canoe trip. No phone access throughout. "
            "Bala and Sam Raja attended."
        ),
        "participants": ["Bala Ravindran", "Sam Raja"],
    },
    {
        "name": "Annapurna Base Camp (ABC) & Poon Hill Trek",
        "location": "Annapurna Region, Nepal",
        "status": "completed",
        "dates": {"start": "2024-10-08", "end": "2024-10-15"},
        "duration_days": 8,
        "max_elevation_ft": 13566,
        "max_elevation_m": 4130,
        "tour_company": "Mountain Nepal (www.mtnepal.com)",
        "guide": "Bal Krishna Tamang (balpub80@hotmail.com)",
        "itinerary": [
            "Day 1: Pokhara → Jhinu Danda by jeep → 2.5h hike to Chhomrong (2170m)",
            "Day 2: Trek to Dovan (2505m), 5–6 hrs",
            "Day 3: Trek to Machhapuchhre Base Camp MBC (3700m), 5–6 hrs",
            "Day 4: 2h early morning walk to ABC (4130m) for sunrise. Trek back to Bamboo, 5–6 hrs",
            "Day 5: Trek to Chhomrong, 5 hrs",
            "Day 6: Trek to Tadapani (2630m), 5 hrs",
            "Day 7: Trek to Ghorepani (2830m), 5 hrs",
            "Day 8: Hike to Poon Hill viewpoint (3120m) for sunrise. Trek to Tikhedhunga, drive to Pokhara",
        ],
        "cost_per_person_usd": {
            "airfare": "~1400",
            "tour_company": 450,
            "internal_flights_and_hotel": 200,
            "misc": "200–500",
            "total_estimate": "2200–2500",
        },
        "included_in_tour": [
            "Government authorized trek guide",
            "Porters (Sherpas – 3 for 6 people, max 25kg each)",
            "Trekking permit & TIMS card",
            "All meals (B/L/D) at tea houses",
            "Hot drinks (tea, coffee, hot chocolate)",
            "Land transportation to/from trek start and end",
            "Welcome and goodbye dinner – Nepalese family",
            "Lodging in tea houses",
        ],
        "not_included": [
            "Alcoholic and soft drinks",
            "Personal expenses",
            "Emergency rescue",
            "International flights",
            "Hotels in Kathmandu and Pokhara",
            "Internal flight KTM ↔ Pokhara",
        ],
        "logistics": {
            "arrive_ktm": "October 6–7, 2024",
            "ktm_to_pokhara_flight": "October 6 or 7 (Buddha Air ~Rs 15,800 / $188)",
            "return_pokhara_to_ktm": "October 16, 7:00 AM Buddha Air",
            "pokhara_hotel": "Big Pillow Inn",
            "kathmandu_hotel": "Hyatt Regency / Hotel Sankar",
        },
        "participants": [
            "Bala Ravindran", "Kannan Ramachandran", "Srikumar Nambiar",
            "Giridhar Ragnar", "Sam Raja", "Binoj Kitchu",
        ],
        "notes": (
            "8-day route via Ghandruk approach, returning via Poon Hill/Ghorepani. "
            "Tea house accommodation throughout. Sherpas carried main bags (max 12.5kg per person). "
            "Hikers carried small day packs. Sleeping bags rentable in Pokhara (250 Rs/day). "
            "Trekking poles rentable (100 Rs/day). Walking slowly above snow line critical. "
            "Temperature: daytime 24–30°C at lower altitudes; MBC/ABC can drop to -10°C at night."
        ),
    },
    {
        "name": "Cactus to Clouds (San Jacinto via Palm Springs Aerial Tramway)",
        "location": "Palm Springs / Mount San Jacinto, California, USA",
        "status": "completed",
        "dates": {"approx": "Before April 2026"},
        "elevation_ft": 10834,
        "notes": (
            "Gopa Ganesan organized and created a detailed Excel packing/time plan per mile. "
            "Referenced as 'Gopa's excel spreadsheet was a masterpiece of hike planning'. "
            "Plan shared with Adi (another member) for their attempt in May 2026."
        ),
        "participants": ["Gopa Ganesan", "Group members"],
        "resources": ["Gopa's mile-by-mile Excel timing spreadsheet shared in group"],
    },
    {
        "name": "Mount Wrightson",
        "location": "Santa Rita Mountains, south of Tucson, Arizona, USA",
        "status": "completed",
        "dates": {"approx": "Late 2024 / early 2025 – training hike"},
        "miles_rt": 10.6,
        "elevation_gain_ft": 4000,
        "peak_elevation_ft": 9500,
        "drive_hours": 3,
        "notes": (
            "Day hike starting at ~5,000 ft, summiting at 9,500 ft. 3,500 ft elevation gain. "
            "Described as 'kick ass' cardio workout. Good leg and lung builder at lower base elevation than Flagstaff."
        ),
        "participants": ["Giridhar Ragnar", "Various group members"],
    },
]

UPCOMING_HIKES = [
    {
        "name": "Kananaskis / Banff Hiking Trip",
        "location": "Kananaskis Country & Banff, Alberta, Canada",
        "status": "upcoming – confirmed & deposit paid",
        "dates": {"approx": "Summer/Fall 2026 (exact dates TBD)"},
        "cost_per_person_usd": 480,
        "notes": (
            "Deposits of $480 per person paid. Multiple group members confirmed. "
            "Bala organizing. Srikumar and Binoy Warrier dropped out; "
            "Gopa Ganesan and potentially Adi took their spots."
        ),
        "participants_confirmed": [
            "Bala Ravindran", "Kannan Ramachandran", "Sam Raja",
            "Binoj Kitchu", "Giridhar Ragnar", "Ravi Reshmi",
            "Chand Vidhu Warrier", "Gopa Ganesan", "Manju Mahesh", "Anish Naina",
        ],
    },
    {
        "name": "Patagonia W Trek (Torres del Paine)",
        "location": "Torres del Paine National Park, Patagonia, Chile",
        "status": "upcoming – reservation confirmed",
        "dates": {"start": "2026-12-10", "end": "2026-12-14", "travel": "Dec 8–15"},
        "duration_days": 5,
        "nights": 4,
        "cost_per_person_usd": 3340,
        "included_in_package": [
            "Private round-trip transport",
            "Catamaran across Lake Pehoe (round-trip)",
            "National Park entrance",
            "Mountain refuge 4 nights",
            "Breakfast, lunch, dinner",
        ],
        "mountain_shelters": ["Central", "Paine Grande", "Grey", "Paine Grande"],
        "highlights": [
            "Towers Viewpoint",
            "French Valley",
            "Grey Glacier",
            "Ferrier's Lookout",
        ],
        "group_size": 10,
        "notes": (
            "Total trip cost ~$5,000–$6,000+ per person including airfare and misc. "
            "Operator confirmed reservation for 10 people. "
            "Price is ~$1,500 higher than previous year quotes. "
            "Binoj Kitchu interested in organizing Spiti Valley India trip for next summer."
        ),
        "participants": [
            "Bala Ravindran", "Kannan Ramachandran", "Srikumar Nambiar",
            "Sam Raja", "Giridhar Ragnar", "Ravi Reshmi",
            "Chand Vidhu Warrier", "Gopa Ganesan", "Manju Mahesh",
            "Anish Naina", "Sajeev",
        ],
    },
    {
        "name": "The Enchantments Traverse",
        "location": "Leavenworth, Washington, USA",
        "status": "proposed – interest expressed",
        "dates": {"approx": "TBD"},
        "source": "https://www.alltrails.com/trail/us/washington/the-enchantments-trail",
        "notes": "Shared by Gopa Ganesan in June 2026. No dates or deposits yet.",
    },
    {
        "name": "European Hut-to-Hut / Inn-to-Inn Routes",
        "location": "France, England, Scotland, Iceland, Spain, TMB Switzerland",
        "status": "proposed – bucket list",
        "dates": {"approx": "TBD – future"},
        "notes": (
            "Mentioned by Bala as strong future options. "
            "TMB (Tour du Mont Blanc) from Switzerland specifically highlighted."
        ),
    },
    {
        "name": "Spiti Valley",
        "location": "Spiti Valley, Himachal Pradesh, India",
        "status": "proposed – casual interest",
        "dates": {"approx": "Next summer (2027?) – very early stage"},
        "notes": "Binoj Kitchu suggested organizing this for next summer after Patagonia.",
    },
]

GEAR_LIST = {
    "official_guide_list": [
        "Backpack (big – carried by Sherpas/porter)",
        "Small day pack (carry yourself during trek)",
        "Waterproof hiking boots with ankle support",
        "Sandals (for end of day relief)",
        "2–3 pairs of thick socks",
        "Light T-shirts (2–3 for daytime)",
        "Thermal / long warm underwear",
        "Warm sleeping bag (rated -5°C / 23°F minimum; 0°F preferred)",
        "Fleece jacket",
        "Windproof jacket and windproof pants",
        "Warm trousers / trekking pants",
        "Down jacket",
        "Water bottle (1–2 L)",
        "Trekking poles (rentable in Pokhara at 100 Rs/day)",
        "Winter hat (wool/fleece)",
        "Gloves",
        "Sunglasses (UV protection)",
        "Headlamp (with extra batteries)",
        "Gaiters",
        "Sunscreen (SPF 30+)",
        "Lip balm",
        "Small towel",
        "Toiletries (toothbrush etc.)",
        "Book / notebook / diary",
        "Medicines: pain relief, cold/fever, altitude sickness (Diamox recommended)",
        "Trekking pole (rentable)",
        "Rain gear / rain jacket (provided by guide)",
    ],
    "rental_in_nepal": {
        "sleeping_bag": "250 Rs/day (~$1.85 at 2024 rates)",
        "trekking_poles": "100 Rs/day (~$0.75)",
        "other_gear": "Most trekking and climbing gear available in Pokhara or Kathmandu",
        "note": "Guide recommends renting locally – much cheaper than buying abroad",
    },
    "packing_tips": [
        "Sherpas carry main bag – limit to 12.5 kg per person (3 Sherpas for 6 hikers, max 25kg/Sherpa)",
        "Excess luggage can be left at Pokhara hotel",
        "Small hydration day pack carried by yourself",
        "45L pack sufficient for most hikers (Sam Raja confirmed)",
        "Check Buddha Air carry-on policy (may need to check in larger bags)",
        "Pack water-repellant, quick-dry, lightweight clothing",
        "No back pocket on shorts recommended (avoids spine misalignment)",
        "Hot-wash all gear before returning home (leeches/bed bugs possible in trail accommodations)",
        "Can do laundry at tea houses (hand wash or outsource; allow 1+ day to dry)",
        "Carry ~$200 USD worth of Nepalese Rupees cash for personal expenses",
    ],
}

PRODUCTS_TO_BUY = [
    {
        "category": "Nutrition / Hydration",
        "item": "Tailwind Nutrition Endurance Fuel – Mandarin, 50 Servings",
        "brand": "Tailwind Nutrition",
        "description": "Electrolyte & hydration sports drink mix powder. Gluten-free, vegan.",
        "link": "https://a.co/d/7e6Jn05",
        "recommended_by": "Giridhar Ragnar",
        "date_shared": "2024-07-16",
        "notes": "Giridhar used 1 salt/electrolyte tab per hour during training.",
    },
    {
        "category": "Footwear",
        "item": "HOKA Hiking Boots (sale – $60 off)",
        "brand": "HOKA",
        "description": "High-performance waterproof hiking boots, discounted during sale.",
        "link": "https://www.gearpatrol.com/outdoors/hoka-hiking-boot-sale/",
        "recommended_by": "Giridhar Ragnar",
        "date_shared": "2024-08-16",
        "notes": "Sam Raja purchased these. Great deal at the time.",
    },
    {
        "category": "Footwear",
        "item": "Merrell Waterproof Hiking Boots",
        "brand": "Merrell",
        "description": "Waterproof hiking boots used by both Giridhar and Bala.",
        "link": None,
        "recommended_by": "Giridhar Ragnar, Bala Ravindran",
        "notes": "Must be broken in before the hike to avoid toe injuries. Break in over multiple hikes.",
    },
    {
        "category": "Footwear",
        "item": "The North Face Summit Series Offtrail TR Shoes",
        "brand": "The North Face",
        "link": "https://hiconsumption.com/style/the-north-face-summit-series-offtrail-tr-shoes/",
        "recommended_by": "Giridhar Ragnar",
        "date_shared": "2024-08-20",
        "notes": "Shared as a high-performance trail shoe option.",
    },
    {
        "category": "Clothing – Pants",
        "item": "Gap Performance Water-Repellant Hiking Pants",
        "brand": "Gap",
        "description": (
            "Lightweight, water-repellant, breathable, quick-dry. "
            "Drawstring waist. No back pocket (good for spine). Separate zipper pocket."
        ),
        "price_usd": 14,
        "where_to_buy": "Sam's Club",
        "recommended_by": "Giridhar Ragnar",
        "date_shared": "2024-08-22",
        "notes": (
            "Sold out quickly in sizes M/S at local Sam's Club. Check online or Mesa Sam's. "
            "Blue Eddie Bauer was also liked. Khaki Eddie Bauer is Giridhar's regular go-to."
        ),
    },
    {
        "category": "Clothing – Pants",
        "item": "Eddie Bauer Hiking Pants / Boots",
        "brand": "Eddie Bauer",
        "description": "Water-repellant hiking pants and boots seen at Sam's Club.",
        "price_usd": {"boots": 39.99, "pants": "~$14"},
        "where_to_buy": "Sam's Club",
        "recommended_by": "Giridhar Ragnar",
        "date_shared": "2024-08-22",
    },
    {
        "category": "Sleeping Bag",
        "item": "Hyke & Byke Duck Down Mummy Backpacking Sleeping Bag – 0°F",
        "brand": "Hyke & Byke",
        "description": "0°F rated mummy sleeping bag. 13 inches long, 8 inches diameter when packed.",
        "price_usd": 179,
        "link": "https://www.amazon.com/Duck-Down-Mummy-Backpacking-Sleeping-Bag-0-Degrees/dp/B01MA31V92/",
        "recommended_by": "Sam Raja",
        "date_shared": "2024-08-26",
        "notes": "Sam owns this and brought it for the Nepal trip. Compact enough to carry.",
    },
    {
        "category": "Sleeping Bag",
        "item": "Goose Down Ultralight Mummy Backpacking Sleeping Bag – 800 FP, rated to -17°C / -30°F",
        "brand": "Hyke & Byke (Goose Down)",
        "description": "Ultralight 800-fill-power goose down mummy bag. Rated -15°F to -30°F.",
        "link": "https://www.amazon.com/Goose-Down-Ultralight-Mummy-Backpacking-Sleeping-Bag-0-15-30-Degree/dp/B06XS6R59L/",
        "recommended_by": "Sam Raja",
        "date_shared": "2024-08-26",
        "notes": "Higher-rated option for very cold nights at MBC/ABC. Overkill for most nights but safe.",
    },
    {
        "category": "Dry Bags / Gear Protection",
        "item": "Outdoor Products Ultimate Dry Sack 3-Pack",
        "brand": "Outdoor Products",
        "link": "https://a.co/d/9LWNAdT",
        "recommended_by": "Giridhar Ragnar",
        "date_shared": "2024-08-27",
        "notes": "To keep gear dry in rain and river crossings.",
    },
    {
        "category": "Medication",
        "item": "Diamox (Acetazolamide) – Altitude Sickness Prevention",
        "brand": "Prescription / OTC depending on country",
        "description": "Prescription medication recommended by guide for altitude sickness prevention.",
        "recommended_by": "Bal Krishna Tamang (guide), Bala Ravindran",
        "notes": (
            "Used successfully on Machu Picchu. ABC reaches 13,750 ft – similar to Humphreys. "
            "Not mandatory but strongly suggested, especially for first-time high-altitude hikers. "
            "Consult a doctor before use."
        ),
    },
    {
        "category": "Gear – REI Sale",
        "item": "REI Labor Day Sale (general gear)",
        "brand": "REI",
        "link": "https://www.rei.com/promotions/labor-day-sale",
        "recommended_by": "Giridhar Ragnar",
        "date_shared": "2024-08-26",
        "notes": "Good time to buy backpacks, boots, and hiking clothing at a discount.",
    },
]

USER_RECOMMENDATIONS = [
    {
        "topic": "Altitude Acclimatization",
        "tips": [
            "Train on Humphreys Peak (12,800 ft) in Flagstaff multiple times before any high-altitude trek.",
            "ABC (13,750 ft) is similar altitude to Pikes Peak – manageable without full acclimatization week if you pace yourself.",
            "Walk very slowly above the snow line to prevent altitude sickness.",
            "Take Diamox (consult doctor). Bala used it successfully on Machu Picchu.",
            "Electrolyte tabs or Tailwind Nutrition powder help – 1 per hour during strenuous hikes.",
            "Arrive in Kathmandu at least 1–2 days before hiking for initial acclimatization.",
        ],
    },
    {
        "topic": "Training Plan",
        "tips": [
            "Do at least 1 long hike per weekend in the months leading up to a major trek.",
            "Increase to 2–3 hikes per weekend as trip date approaches.",
            "Target 10 miles / 2,500 ft elevation gain per day on training hikes.",
            "Flagstaff (Humphreys + Elden + Kendrick) is the ideal 3-day training block – plan a trip there.",
            "Mt. Wrightson (south of Tucson) is excellent: 10.6 mi RT, 4,000 ft gain, 9,500 ft peak.",
            "Piestewa Peak in Phoenix is useful for short intense cardio – Elden is ~2X harder.",
            "Mormon Trail in Phoenix usable for flat-speed training.",
            "Deem Hills hiking group organizes Sunday morning group hikes – good community training.",
        ],
    },
    {
        "topic": "Gear & Packing",
        "tips": [
            "Break in hiking boots over multiple hikes before the trip. Merrell boots especially need this.",
            "Limit main bag to 12.5 kg when Sherpas are provided (3 Sherpas for 6 hikers).",
            "A 45L pack is sufficient; 75L is overkill for 8-day tea house trek.",
            "Rent sleeping bags and poles in Pokhara – much cheaper (250 Rs/day bag, 100 Rs/day poles).",
            "Bring your own sleeping bag for hygiene reasons if you can (rental bags may not be washed between uses).",
            "Water-repellant, lightweight, quick-dry pants essential above snow line.",
            "Hydration pack / bladder for day pack is useful.",
            "Pack a small diary/book – tea houses have no entertainment in evenings.",
            "Carry a headlamp even on day hikes.",
        ],
    },
    {
        "topic": "Nepal Logistics",
        "tips": [
            "Fly Phoenix → Kathmandu. Options: American/Qatar via Doha, United/Singapore via Singapore.",
            "Internal flight KTM ↔ Pokhara: Buddha Air is recommended (~$188 USD or Rs 15,800 booked via Indian agent).",
            "Book Kathmandu–Pokhara flights early – small planes fill up, everyone wants the first flight.",
            "Get SIM card in Nepal – very limited phone signal on trails but power to charge phones everywhere.",
            "Passport-size photo and passport copy required by the guide for trekking permits.",
            "30% deposit (≈$150/person or Rs 12,000) required to book the trek.",
            "Carry ~$200 USD equivalent in Nepali Rupees for personal expenses (drinks, tips, extras).",
            "Excess luggage can be stored at your Pokhara hotel during the trek.",
            "Recommended hotels: Big Pillow Inn (Pokhara), Hyatt Regency (Kathmandu), Hotel Sankar (Kathmandu).",
            "Mountain Everest flight option: airplane ~$225–240 USD per person (1-hour flight close to Everest).",
            "Helicopter tour to EBC: ~$1,200–$1,350 USD per person.",
        ],
    },
    {
        "topic": "Tea House Life on the Trail",
        "tips": [
            "Tea houses provide blankets but bring or rent a sleeping bag for MBC/ABC nights (-10°C possible).",
            "Dining rooms heated by kerosene stove in tea houses.",
            "Menu at every tea house – Muesli with milk and Tibetan bread are popular breakfasts.",
            "Laundry can be done at tea houses (hand wash yourself or pay to outsource); allow 1 day to dry.",
            "Hot spring at Jhinu Danda on the route – plan a soak.",
            "No alcohol included in trek cost; available to purchase separately.",
            "Hot drinks (tea, coffee, hot chocolate) included in tour cost.",
        ],
    },
    {
        "topic": "Health & Safety",
        "tips": [
            "Hot-wash all clothes after returning from Nepal (bed bugs and leeches possible).",
            "Wear masks and avoid handshakes during high-transmission periods.",
            "No back pockets on shorts recommended to keep the spine aligned while hiking.",
            "Walking poles reduce knee stress significantly on descents.",
            "Emergency rescue is not included in tour cost – consider travel insurance with evacuation cover.",
        ],
    },
]


# ─────────────────────────────────────────────
# 3. DYNAMIC EXTRACTION from messages
# ─────────────────────────────────────────────

def extract_links(messages: list[dict]) -> list[dict]:
    """Pull all URLs shared in the chat with context."""
    URL_RE = re.compile(r'https?://[^\s\)\"\']+')
    links = []
    seen = set()
    for msg in messages:
        for url in URL_RE.findall(msg["text"]):
            if url in seen:
                continue
            seen.add(url)
            # Skip personal share links, zoom, drive, etc.
            skip = ["zoom.us", "docs.google.com", "bit.ly", "air.tl",
                    "x.com", "instagram.com", "facebook.com", "youtu", "azdot.gov"]
            if any(s in url for s in skip):
                continue
            links.append({
                "url": url,
                "shared_by": msg["author"],
                "date": msg["date"],
                "context": msg["text"][:200].replace("\n", " "),
            })
    return links


def extract_polls(messages: list[dict]) -> list[dict]:
    """Extract POLL results from the chat."""
    polls = []
    in_poll = False
    current_poll = {}

    for msg in messages:
        text = msg["text"]
        if text.strip().startswith("POLL:"):
            if current_poll:
                polls.append(current_poll)
            current_poll = {
                "date": msg["date"],
                "by": msg["author"],
                "question": text.split("\n")[0].replace("POLL:", "").strip(),
                "options": [],
            }
            in_poll = True
        elif in_poll and text.strip().startswith("OPTION:"):
            line = text.strip()
            m = re.match(r"OPTION:\s*(.+?)\s*\((\d+)\s*votes?\)", line)
            if m:
                current_poll["options"].append({"option": m.group(1), "votes": int(m.group(2))})
            else:
                current_poll["options"].append({"option": line.replace("OPTION:", "").strip()})
        else:
            if in_poll and current_poll:
                polls.append(current_poll)
                current_poll = {}
                in_poll = False

    if current_poll:
        polls.append(current_poll)
    return polls


def extract_itineraries(messages: list[dict]) -> list[dict]:
    """Find messages that contain day-by-day itineraries."""
    DAY_RE = re.compile(r'Day\s*\d', re.I)
    results = []
    seen_texts = set()
    for msg in messages:
        text = msg["text"]
        day_count = len(DAY_RE.findall(text))
        if day_count >= 3:
            key = text[:100]
            if key not in seen_texts:
                seen_texts.add(key)
                results.append({
                    "date": msg["date"],
                    "shared_by": msg["author"],
                    "itinerary_text": text.strip(),
                })
    return results


def participation_summary(messages: list[dict]) -> dict:
    """Count messages per participant."""
    counts: dict[str, int] = {}
    for msg in messages:
        author = msg["author"]
        if author != "SYSTEM":
            counts[author] = counts.get(author, 0) + 1
    return dict(sorted(counts.items(), key=lambda x: -x[1]))


# ─────────────────────────────────────────────
# 4. ASSEMBLE JSON
# ─────────────────────────────────────────────

def build_output(chat_file: str) -> dict:
    print(f"Parsing chat: {chat_file}")
    messages = parse_chat(chat_file)
    print(f"  -> {len(messages)} usable messages parsed")

    links      = extract_links(messages)
    polls      = extract_polls(messages)
    itineraries = extract_itineraries(messages)
    participants = participation_summary(messages)

    return {
        "meta": {
            "source_file": Path(chat_file).name,
            "generated": datetime.now().isoformat(timespec="seconds"),
            "total_messages_parsed": len(messages),
            "date_range": {
                "first": messages[0]["date"] if messages else None,
                "last": messages[-1]["date"] if messages else None,
            },
            "group_name": "ABC Annapoorna Base Camp October 24 (now: Kananaskis Hike)",
        },
        "participants": participants,
        "past_hikes": PAST_HIKES,
        "upcoming_hikes": UPCOMING_HIKES,
        "gear": GEAR_LIST,
        "products_to_buy": PRODUCTS_TO_BUY,
        "user_recommendations": USER_RECOMMENDATIONS,
        "polls": polls,
        "itineraries_raw": itineraries,
        "resource_links": links,
    }


# ─────────────────────────────────────────────
# 5. MAIN
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    chat_path = (
        sys.argv[1]
        if len(sys.argv) > 1
        else r"C:\Users\reshm\Downloads\kananaskis_chat\WhatsApp Chat with Kananaskis Hike.txt"
    )
    out_path = (
        sys.argv[2]
        if len(sys.argv) > 2
        else r"C:\Users\reshm\Documents\hiking-website\trails.json"
    )

    if not Path(chat_path).exists():
        print(f"ERROR: Chat file not found: {chat_path}")
        sys.exit(1)

    data = build_output(chat_path)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nSaved -> {out_path}")
    print(f"   Past hikes    : {len(data['past_hikes'])}")
    print(f"   Upcoming hikes: {len(data['upcoming_hikes'])}")
    print(f"   Gear items    : {len(data['gear']['official_guide_list'])}")
    print(f"   Products      : {len(data['products_to_buy'])}")
    print(f"   Rec categories: {len(data['user_recommendations'])}")
    print(f"   Polls         : {len(data['polls'])}")
    print(f"   Resource links: {len(data['resource_links'])}")
    print(f"   Participants  : {len(data['participants'])}")
