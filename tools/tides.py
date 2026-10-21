"""Current regional tide reference, checked in the visible October 22 tab."""
import json
from pathlib import Path
URL='https://tides.today/en/%F0%9F%8C%8D/indonesia/bali/benoa'
def apply_tides(data):
 data['tide_notice']='Проверено 21 октября; время Бали, UTC+8. Прогноз района Беноа, не измерения на отдельных пляжах. Волны, течения, флаги и спасатели определяют возможность купаться.'
 for d in data['days']:
  d.pop('tides',None)
  if d['date']=='2026-10-22':d['tides']=dict(area='Южные пляжи: региональный ориентир Беноа',text='22 октября: высокая вода 07:07, низкая 13:33, высокая 20:07. Пандава 10:00-11:00 и Melasti 11:40-12:40 — убывающая вода; Geger 14:55-15:25 и Mengiat 15:45-16:05 — растущая. Эти часы не гарантируют безопасного купания. Закат в районе Беноа около 18:14; Jaran Hill 17:50-18:15 включает уход в сумерках, при отставании сократить осмотр.',source_name='Tides Today · выбран Thursday October 22',source_url=URL,checked='2026-10-21',timezone='Asia/Makassar')
 if not any(s['url']==URL for s in data['sources']):data['sources'].append(dict(name='Tides Today · Беноа 22 октября',url=URL,checked='2026-10-21'))
if __name__=='__main__':
 p=Path(__file__).resolve().parents[1]/'itinerary.json';d=json.loads(p.read_text('utf8'));apply_tides(d);p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n','utf8')
