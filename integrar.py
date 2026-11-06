from pathlib import Path
from datetime import datetime
import argparse, re, shutil
PROJECTS=[('smart-building-3d','Smart Building 3D','Arquitetura digital','Explore um edifício residencial e seus ambientes.'),('halloween-pos','Halloween POS','Sistemas comerciais','Frente de caixa e retaguarda demonstrativas.'),('construction-3d','Construction 3D','Engenharia civil','Acompanhe 17 etapas de uma obra educativa.')]
def integrate(target):
 source=Path(__file__).resolve().parent
 target=Path(target).resolve()
 index=target/'index.html'
 if not index.is_file():raise SystemExit('Não encontrei index.html na pasta do portfólio. Nada foi modificado.')
 raw=index.read_bytes()
 try:text=raw.decode('utf-8')
 except UnicodeDecodeError:raise SystemExit('O HTML não é UTF-8. Faça uma cópia UTF-8 antes de integrar. Nada foi modificado.')
 if '</body>' not in text.lower():raise SystemExit('Página sem fechamento de body. Nada foi modificado.')
 if 'Eduardo' not in text and 'portfolio' not in text.lower() and 'portfólio' not in text.lower():
  raise SystemExit('Não reconheci a página principal do portfólio. Confira a pasta indicada. Nada foi modificado.')
 if source==target:raise SystemExit('Extraia o pacote em outra pasta e informe a pasta do portfólio como destino.')
 backup=target/('backup-integracao-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
 backup.mkdir(parents=True)
 shutil.copy2(index,backup/'index.html')
 files=[p for p in (source/'projetos').rglob('*') if p.is_file()]+[source/'laboratorio.html']
 for p in files:
  relative=p.relative_to(source);dest=target/relative
  if dest.is_file():
   saved=backup/relative;saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(dest,saved)
  dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
 missing=[]
 for slug,name,cat,desc in PROJECTS:
  pattern='href=([\'"])([^\'"]*'+re.escape(slug)+'[^\'"]*)\\1'
  if re.search(pattern,text,re.I):
   text=re.sub(pattern,lambda m:'href='+m.group(1)+'./projetos/'+slug+'/'+m.group(1),text,flags=re.I)
  else:missing.append((slug,name,cat,desc))
 if missing:
  grid=''.join(f'<a class="lab-card" href="./projetos/{slug}/"><small>{cat}</small><h3>{name}</h3><p>{desc}</p><span>Abrir experiência →</span></a>' for slug,name,cat,desc in missing)
  section='<section class="lab-integration" id="laboratorio-integrado"><h2>Projetos interativos</h2><div class="lab-grid">'+grid+'</div></section>'
  text=re.sub(r'</body>',lambda m:section+'\n'+m.group(0),text,count=1,flags=re.I)
  if 'projetos/_shared/cards.css' not in text:
   text=re.sub(r'</head>',lambda m:'<link rel="stylesheet" href="./projetos/_shared/cards.css">\n'+m.group(0),text,count=1,flags=re.I)
 if text.encode('utf-8')!=raw:index.write_bytes(text.encode('utf-8'))
 print('Integração concluída. Página inicial preservada; apenas links/cards dos projetos foram integrados.')
 print('Backup:',backup)
 print('Sirva a pasta do portfólio e abra /laboratorio.html ou a página inicial.')
if __name__=='__main__':
 parser=argparse.ArgumentParser(description='Integra 3 projetos com backup, sem substituir o portfólio.')
 parser.add_argument('pasta_portfolio')
 integrate(parser.parse_args().pasta_portfolio)
