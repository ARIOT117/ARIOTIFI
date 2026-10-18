"""Count native objects separately from V8 wrappers, avoiding double counting."""
import json,sys,collections
from pathlib import Path
base=Path('measurements/final-audit');out={}
for label in sys.argv[1:] or ['baseline-with-fixed','stress-fixed']:
 h=json.loads((base/(label+'.heapsnapshot')).read_text());meta=h['snapshot']['meta'];fields=meta['node_fields'];n=len(fields);ni=fields.index('name');ti=fields.index('type');di=fields.index('detachedness') if 'detachedness' in fields else None;nodes=h['nodes'];strings=h['strings'];types=meta['node_types'][ti];count=collections.Counter()
 for i in range(0,len(nodes),n):
  name=strings[nodes[i+ni]];kind=types[nodes[i+ti]]
  if kind=='native':
   for prefix,key in [('<img','HTMLImageElement_DOM'),('<canvas','HTMLCanvasElement_DOM'),('<clipPath','SVGClipPathElement_DOM')]:
    if name==prefix+'>' or name.startswith(prefix+' '):
     count[key]+=1
     if di is not None and nodes[i+di]==2:count[key+'_detached']+=1
   if name in ('MutationObserver','ResizeObserver'):count[name]+=1
  if kind=='object' and name in ('WavyProgress','FlowerButton'):count[name]+=1
 out[label]=dict(count);print(label,dict(count),flush=True)
(base/'heap-counts.json').write_text(json.dumps(out,indent=2))
