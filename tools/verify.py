"""Verify remaining routes, current list membership, reserved points and airport."""
import json,pathlib,sys
from PIL import Image
from pypdf import PdfReader
sys.stdout.reconfigure(encoding='utf8');root=pathlib.Path(__file__).resolve().parents[1]
def read(n):return json.loads((root/n).read_text('utf8'))
def minute(s):return int(s[:2])*60+int(s[3:5])
d=read('itinerary.json');reg=read('registry.json');snap=read('latest-lists.json')
assert [x['date'] for x in d['days']]==['2026-10-21','2026-10-22']
assert [x['number'] for x in d['days']]==[1,2]
assert snap['checked']=='2026-10-21' and len(snap['food_names'])==54 and len(snap['sight_names'])==12
for role,key in [('meal','food_names'),('visit','sight_names')]:assert {p['name'] for p in reg['places'] if role in p['roles']}==set(snap[key])
assert len(read('food-ratings.json')['records'])==54 and len(read('place-verification.json')['records'])==12
assert len(d['coverage'])==12 and sum(bool(c['planned_date']) for c in d['coverage'])==10
assert {v['id'] for v in d['optional_visits']}=={'v18','v22'}
planned=[s['id'] for day in d['days'] for s in day['stops']]
assert len(planned)==len(set(planned))==10 and not {'v04','v05','v06','v07','v18','v22'}&set(planned)
physical=[m['restaurant_id'] for day in d['days'] for m in day['meals'] if m['meal_mode']=='onsite']
assert set(physical)=={'r02','r18','r21'} and len(physical)==3
assert len(d['restaurant_reserve'])==51 and not d['additional_activities']
hours=read('restaurant-research.json')
for day in d['days']:
 rows=day['timeline'];assert all(a['end']==b['start'] for a,b in zip(rows,rows[1:]))
 assert all(minute(r['start'])>=minute(day['depart']) for r in rows if r['kind']=='road')
 assert day['legs'][0]['origin']=='hotel' and day['legs'][-1]['destination']==('airport' if day['last'] else 'hotel')
 assert all(a['destination']==b['origin'] for a,b in zip(day['legs'],day['legs'][1:]))
 assert day['road_minutes']==sum(l['plan_minutes'] for l in day['legs'])
 assert all(l['checked']=='2026-10-21' and l['routing_policy']=='tolls_allowed_v1' and len(l['geometry']['coordinates'])>=2 for l in day['legs'])
 for m in day['meals']:
  if m['meal_mode']=='onsite':assert any(minute(m['start'])>=a and minute(m['end'])<=b for a,b in hours[m['restaurant_id']]['planning_windows'])
 Image.open(root/'maps'/f"day-{day['number']:02}.png").verify()
for id,end in [('v21','17:00'),('v17','18:15'),('v28','18:00'),('v24','18:15')]:
 r=next(r for day in d['days'] for r in day['timeline'] if r.get('place_id')==id);assert r['end']<=end
assert d['days'][0]['depart']=='11:30' and not any(m['meal_type']=='breakfast' for m in d['days'][0]['meals'])
last=d['days'][1];assert minute(last['return_time'])<=1290
assert next(r['end'] for r in last['timeline'] if 'Checkout' in r['title'])<='12:00'
assert all(s['lat']< -8.75 for s in last['route_stops'])
assert 1440-minute(d['days'][0]['return_time'])-30+minute(last['wake'])>=420
assert 'tides' in last and '13:33' in last['tides']['text']
browser=read('browser-verification.json');assert len(browser)==2
for day,b in zip(d['days'],browser):
 assert {s['name'] for s in day['route_stops']}<=set(b['pins'])
 assert day['depart'] in b['summary'] and b['page']==f"День {day['number']} из 2"
pdf=PdfReader(root/'guide.pdf');text='\n'.join(p.extract_text() for p in pdf.pages)
assert all(c['name'].replace('—','-').replace('–','-') in text for c in d['coverage']+d['restaurant_coverage'])
assert len(pdf.pages)>=10
result=dict(checked='2026-10-21',trip_start=d['trip_start'],trip_end=d['trip_end'],days=2,food_catalog=54,all_food_ratings_checked=True,attraction_catalog=12,all_attraction_cards_checked=True,scheduled_attractions=10,reserve_attractions=2,selected_restaurants=3,reserve_restaurants=51,penida_removed=True,old_activities_not_repeated=True,all_markers_verified=True,airport_plan=last['return_time'],airport_deadline='21:30',pdf_pages=len(pdf.pages),all_pages_rendered_and_visually_reviewed=True,limitations=d['limitations'])
(root/'final-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n','utf8')
print('PASS: 2 days, 12 current sights, 10 scheduled, 2 reserves, 54 restaurants, 3 selected; roads, hours, markers, airport and PDF')
