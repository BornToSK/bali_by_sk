"""Render the same itinerary and map images used by the website into an offline PDF."""
import json,pathlib,html,sys
from PIL import Image as PILImage,ImageDraw,ImageFont
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Image,PageBreak,Table,TableStyle,KeepTogether
sys.stdout.reconfigure(encoding='utf-8')
root=pathlib.Path(__file__).resolve().parents[1]
data=json.loads((root/'itinerary.json').read_text('utf-8'))
font='C:/Windows/Fonts/arial.ttf';bold='C:/Windows/Fonts/arialbd.ttf'
pdfmetrics.registerFont(TTFont('Bali',font));pdfmetrics.registerFont(TTFont('BaliBold',bold))
# Browser screenshots are JPEG bytes; convert into true PNGs, with a clean heading
# and visible map attribution. All maps follow the current 13-22 October calendar.
for n in [*(d['number'] for d in data['days']),'overview']:
    path=root/'maps'/('overview.png' if n=='overview' else f'day-{n:02}.png')
    image=PILImage.open(path)
    if image.format!='JPEG':continue
    map_image=image.crop((0,67,1500,1167));canvas=PILImage.new('RGB',(1500,1190),'#f5f2e9');canvas.paste(map_image,(0,50));draw=ImageDraw.Draw(canvas)
    title='Бали - актуальные дорожные цепочки' if n=='overview' else f"{data['days'][n-1]['date']} - {data['days'][n-1]['title']}"
    draw.text((24,12),title,fill='#173f37',font=ImageFont.truetype(bold,24))
    draw.text((24,1158),'OpenFreeMap / OpenMapTiles / © OpenStreetMap contributors - OSRM - 13.10.2026',fill='#173f37',font=ImageFont.truetype(font,17))
    canvas.save(path,format='PNG')

styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='BaliBody',fontName='Bali',fontSize=9,leading=13,textColor=colors.HexColor('#173f37'),spaceAfter=7))
styles.add(ParagraphStyle(name='BaliTitle',fontName='BaliBold',fontSize=26,leading=30,textColor=colors.HexColor('#173f37'),spaceAfter=16))
styles.add(ParagraphStyle(name='BaliH',fontName='BaliBold',fontSize=15,leading=19,textColor=colors.HexColor('#173f37'),spaceAfter=10))
styles.add(ParagraphStyle(name='BaliSmall',fontName='Bali',fontSize=8,leading=11,textColor=colors.HexColor('#173f37'),spaceAfter=4))
def clean(s):return str(s).replace('–','-').replace('—','-').replace('→',' > ').replace('↗','')
def p(s,style='BaliBody'):return Paragraph(html.escape(clean(s)),styles[style])
def link(label,url):return Paragraph(f'<link href="{html.escape(url,quote=True)}" color="#235749">{html.escape(clean(label))}</link>',styles['BaliSmall'])
def img(path,width=499):
    im=PILImage.open(path);return Image(str(path),width=width,height=width*im.height/im.width)
def footer(c,doc):
    c.setStrokeColor(colors.HexColor('#d6d9cc'));c.line(48,39,547,39);c.setFont('Bali',8);c.setFillColor(colors.HexColor('#173f37'));c.drawString(48,26,'Бали вдвоём - обновлено 13.10.2026 - время Бали, UTC+8');c.drawRightString(547,26,str(doc.page))
story=[p('Бали вдвоём','BaliTitle'),p('Ваш маршрут на 13-22 октября 2026','BaliH'),img(root/'assets/coast.png'),Spacer(1,18),p('Одна база: Nunamkhalu Private Villas & Spa. Маршрут начинается 13 октября. Все 68 точек еды распределены по 10 дням.'),p('68 точек еды и 25 достопримечательностей на картах дней. Все точки назначены по времени по вашему выбору; программа очень насыщенная.'),p('Каждый день завтрак на вилле 08:00-08:45, выезд в 09:00. Все ночи на Nunamkhalu. Время в пути оценочное; катера, столы и услуги виллы ещё нужно подтвердить.'),PageBreak(),p('Поездка в одном взгляде','BaliTitle'),img(root/'maps/overview.png'),Spacer(1,12)]
overview=[[p('Дата','BaliSmall'),p('Маршрут','BaliSmall'),p('Выезд / финиш','BaliSmall')]]
for d in data['days']:overview.append([p(d['date'][5:],'BaliSmall'),p(d['title'],'BaliSmall'),p(d['depart']+' / '+d['return_time'],'BaliSmall')])
table=Table(overview,colWidths=[65,315,119],repeatRows=1);table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e6eadf')),('VALIGN',(0,0),(-1,-1),'TOP'),('BOTTOMPADDING',(0,0),(-1,-1),7)]));story.extend([table,PageBreak()])
for d in data['days']:
    story.extend([p(f"{d['date']} - день {d['number']}",'BaliH'),p(d['title'],'BaliTitle'),p(f"Выезд {d['depart']} - {'аэропорт' if d['last'] else 'возвращение'} {d['return_time']} - {d['distance_km_known']} км - {d['road_minutes']//60} ч {d['road_minutes']%60} мин в дороге"),img(root/'maps'/f"day-{d['number']:02}.png"),Spacer(1,10),p(d['why'])])
    story.extend([p(d['risk'],'BaliSmall'),link('Первый переезд - открыть Google Maps',d['legs'][0]['navigation_url']),link('Последний переезд - открыть Google Maps',d['legs'][-1]['navigation_url']),PageBreak(),p(f"{d['date']} - расписание",'BaliTitle')])
    rows=[[p('Время','BaliSmall'),p('Действие','BaliSmall')]]
    for r in d['timeline']:
        title=clean(r['title']);note=r.get('note','');text=html.escape(title)
        if r.get('number'):text=f"<b>{r['number']}.</b> "+text
        if r.get('place_url'):text=f'<link href="{html.escape(r["place_url"],quote=True)}">{text}</link>'
        if r['kind']=='road':text+=f"<br/>{r['distance_km']} км; план {r['duration_minutes']} мин"
        elif r['kind']!='buffer':text+='<br/>'+html.escape(clean(note))
        if r.get('hours_label'):text+='<br/>'+html.escape(clean(r['hours_label']))
        rows.append([p(r['start']+' - '+r['end'],'BaliSmall'),Paragraph(text,styles['BaliSmall'])])
    table=Table(rows,colWidths=[85,414],repeatRows=1,hAlign='LEFT')
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e6eadf')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),('LINEBELOW',(0,0),(-1,-1),.35,colors.HexColor('#d9dfd3'))]))
    story.extend([table,PageBreak()])
story.extend([p('Все 68 точек еды','BaliTitle'),p('Каждое заведение назначено один раз. Часть остановок - дегустация или лёгкое блюдо. Echo Beach: еду ещё нужно подтвердить.')])
rows=[[p('Заведение','BaliSmall'),p('Дата','BaliSmall')]]
for c in data['restaurant_coverage']:rows.append([p(c['name'],'BaliSmall'),p(c['date'][5:],'BaliSmall')])
table=Table(rows,colWidths=[414,85],repeatRows=1);table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e6eadf')),('BOTTOMPADDING',(0,0),(-1,-1),6)]));story.extend([table,PageBreak(),p('Все 25 достопримечательностей','BaliTitle')])
for c in data['coverage']:story.append(p(c['name']+' - '+(c['planned_date'] or 'по желанию; решение не принято')))
story.extend([PageBreak(),p('Что согласовать','BaliTitle')])
for s in data['limitations']:story.append(p(s))
story.extend([p('Завтрак и выезд','BaliH'),p('Завтрак на вилле с 08:00 по вашему сообщению, каждый день 08:00-08:45. Выезд в 09:00. Боксы не нужны.'),p('Вылет','BaliH'),p('22 октября checkout до 12:00; хранение багажа и душ подтвердить. План DPS 21:10, обязательная цель не позднее 21:30. Вылет 23 октября 00:30.'),p('Источники','BaliH')])
for s in data['sources']:story.append(link(s['name']+' - '+s.get('checked',''),s['url']))
SimpleDocTemplate(str(root/'guide.pdf'),pagesize=A4,leftMargin=48,rightMargin=48,topMargin=45,bottomMargin=52,title='Бали вдвоём - маршрут из 68 заведений',author='Bali by SK').build(story,onFirstPage=footer,onLaterPages=footer)
print('PDF and updated static maps generated',flush=True)
