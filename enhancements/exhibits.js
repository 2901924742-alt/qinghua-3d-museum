import {copy, introductionEN, hotspots} from './content.js';

const museum='史密森国家亚洲艺术博物馆 · 弗利尔美术馆';
const museumEN='Smithsonian National Museum of Asian Art · Freer Gallery';
const base='https://www.si.edu/object/3d/';
const figures={level:.53,angle:0,zh:['人物与庭院','观察器身上的人物、庭院与花木。青花线描沿曲面展开，转动瓶身可比较不同面上的画面。'],en:['Figures and gardens','Observe the figures, gardens and plants around the body. Rotate the vessel to compare the cobalt line drawings on its different sides.']};
const foot={level:.09,angle:.3,zh:['底足与边饰','观察底足、蓝色边饰与白釉留白。展台上的大小经过统一，并不表示文物的实际比例。'],en:['Foot and borders','Inspect the foot, blue borders and reserved white glaze. Display sizes are normalized and do not represent the objects at their actual scale.']};
const lid={level:.91,angle:-.35,zh:['瓶盖与肩颈','转到较高视角，观察盖钮、盖面和肩颈的轮廓与青花纹饰。'],en:['Cover and shoulder','Rotate to a higher view to examine the cover, finial, shoulder and their blue decoration.']};
const sourceNote='模型来自博物馆公开扫描数据（CC0）；为网页展示精简几何及辅助贴图，保留原始青花色彩图。展品中文名称为本展馆的描述性译名。';
const sourceNoteEN='The model uses the museum’s CC0 scan data. Geometry and auxiliary maps are optimized for the web; the original colour texture is retained. Chinese exhibit names are descriptive translations.';
export const exhibits=[
 {id:'original',url:'./qinghuaci.glb',hotspots,zh:{exhibit:copy.zh.exhibit},en:{exhibit:copy.en.exhibit,intro:introductionEN}},
 {id:'covered-192',url:'./models/covered-vase-192.glb',hotspots:[figures,lid,foot],
  source:[museum,base+'baluster-vase-one-three-five-piece-garniture-f1980190-194%3Ad8c62634-4ebc-11ea-b77f-2e728ce88125'],
  zh:{exhibit:'青花人物纹盖瓶 · 192',intro:`制作人：屈劲舟<br><br>白釉瓶身上绘有钴蓝人物与庭院场景，瓶盖、肩颈和底足共同形成层次丰富的轮廓。可以转动、拉近，观察不同面上的青花线描。<br><br>原件收藏于${museum}，藏品编号 F1980.192a–c；馆方记录组装后高 45.5 厘米、直径 17.1 厘米。<br><br>${sourceNote}`,scope:sourceNote},
  en:{exhibit:'Blue-and-White Covered Vase · 192',intro:`Created by Qu Jinzhou<br><br>Cobalt-blue figures and garden scenes cover the white-glazed body. Rotate and zoom to examine the cover, shoulder, foot and line drawings.<br><br>Collection: ${museumEN}. Accession F1980.192a–c. Museum dimensions, assembled: height 45.5 cm; diameter 17.1 cm.<br><br>${sourceNoteEN}`,scope:sourceNoteEN}},
 {id:'beaker-193',url:'./models/beaker-vase-193.glb',hotspots:[figures,{level:.93,angle:-.35,zh:['喇叭口与分层','宽阔的喇叭口、收束的中部和下腹形成觚式轮廓。观察各段画面之间的蓝色边饰。'],en:['Flared rim and sections','The flared mouth, narrow middle and lower body form a beaker silhouette. Look at the blue borders dividing the painted sections.']},foot],
  source:[museum,base+'beaker-shaped-vase-five-piece-garniture-f1980190-194%3Ad8c63a70-4ebc-11ea-b77f-2e728ce88125'],
  zh:{exhibit:'青花人物纹觚式瓶 · 193',intro:`制作人：屈劲舟<br><br>器物具有宽阔的喇叭口和收束的中部，白釉表面绘有钴蓝人物与庭院场景，各段以蓝色边饰相隔。转到高处可观察口沿与开口形态。<br><br>原件收藏于${museum}，藏品编号 F1980.193a–b；馆方记录高 42.5 厘米、直径 21.2 厘米。<br><br>${sourceNote}`,scope:sourceNote},
  en:{exhibit:'Blue-and-White Beaker Vase · 193',intro:`Created by Qu Jinzhou<br><br>A flared mouth and narrow middle define this beaker-shaped vase. Cobalt-blue figures and garden scenes are separated by blue borders. Rotate upwards to inspect the rim and opening.<br><br>Collection: ${museumEN}. Accession F1980.193a–b. Museum dimensions: height 42.5 cm; diameter 21.2 cm.<br><br>${sourceNoteEN}`,scope:sourceNoteEN}},
 {id:'vase-191',url:'./models/covered-vase-191.glb',hotspots:[figures,{level:.93,angle:-.35,zh:['口沿与肩颈','本扫描展示器身，不含瓶盖。观察口沿、肩颈轮廓和其上的青花纹饰；馆藏原件为带盖瓶。'],en:['Rim and shoulder','This scan shows the body without its cover. Inspect the rim, shoulder and blue decoration; the original museum object is a covered vase.']},foot],
  source:[museum,base+'baluster-vase-five-piece-garniture-f1980190-194%3Ad8c6393a-4ebc-11ea-b77f-2e728ce88125'],
  zh:{exhibit:'青花人物纹瓶 · 191',intro:`制作人：屈劲舟<br><br>白釉器身上绘有庭院人物、舞者与乐师，肩颈饰花卉。它与展馆中的 192 号盖瓶是不同的馆藏扫描，适合比较器身轮廓与纹饰。此扫描仅展示器身，馆藏原件带有瓶盖。<br><br>原件收藏于${museum}，藏品编号 F1980.191a–c；馆方记录原件组装后高 46.3 厘米、直径 17.2 厘米，并非本扫描器身的尺寸。<br><br>${sourceNote}`,scope:sourceNote+'此扫描仅含器身，不含原件瓶盖。'},
  en:{exhibit:'Blue-and-White Vase · 191',intro:`Created by Qu Jinzhou<br><br>The white-glazed body depicts a court lady, dancer and musicians. Flowers decorate the neck. This separate scan from vase 192 allows the bodies and decoration to be compared. The scan shows the body only; the museum object has a cover.<br><br>Collection: ${museumEN}. Accession F1980.191a–c. Museum dimensions for the assembled original, not this body-only scan: height 46.3 cm; diameter 17.2 cm.<br><br>${sourceNoteEN}`,scope:sourceNoteEN+' This scan includes the body only, without the original cover.'}}
];
