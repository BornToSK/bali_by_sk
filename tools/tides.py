"""Current regional tide reference, checked in the visible October 22 tab."""
import json
from pathlib import Path
URL='https://tides.today/en/%F0%9F%8C%8D/indonesia/bali/benoa'
def apply_tides(data):
 data['tide_notice']='22 октября пляжных остановок нет: день сборов и вылета. Прогноз проверен 21 октября; время Бали, UTC+8. Прогноз района Беноа, не измерения на отдельных пляжах. Волны, течения, флаги и спасатели определяют возможность купаться.'
 for d in data['days']:
  d.pop('tides',None)
  if d['date']=='2026-10-22' and d['stops']:d['tides']=dict(area='Южные пляжи: региональный ориентир Беноа',text='22 октября: высокая вода 07:07, низкая 13:33, высокая 20:07. Geger и Mengiat запланированы около низкой воды и на её подъёме. Точные часы пляжей указаны в расписании. Эти часы не гарантируют безопасного купания; Waterblow — только смотровая. Закат в районе Беноа около 18:14.',source_name='Tides Today · выбран Thursday October 22',source_url=URL,checked='2026-10-21',timezone='Asia/Makassar')
 if not any(s['url']==URL for s in data['sources']):data['sources'].append(dict(name='Tides Today · Беноа 22 октября',url=URL,checked='2026-10-21'))
if __name__=='__main__':
 p=Path(__file__).resolve().parents[1]/'itinerary.json';d=json.loads(p.read_text('utf8'));apply_tides(d);p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n','utf8')
