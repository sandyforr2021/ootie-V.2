// Only garment properties are inferred. No identity, body type or demographic labels.
export const clothingVisionLabels = [
  ['a t-shirt', 'Tops', 'T 恤'], ['a button-up shirt', 'Tops', '襯衫'],
  ['a knitted sweater', 'Tops', '針織毛衣'], ['a sweatshirt', 'Tops', '大學 T'],
  ['a sleeveless tank top', 'Tops', '無袖背心'], ['a blouse', 'Tops', '女裝襯衫'],
  ['a pair of jeans', 'Bottoms', '牛仔長褲'], ['a pair of trousers', 'Bottoms', '長褲'],
  ['a pair of shorts', 'Bottoms', '短褲'], ['a skirt', 'Bottoms', '裙子'],
  ['a dress', 'Dress', '洋裝'], ['a jumpsuit', 'Dress', '連身褲'],
  ['a coat', 'Outerwear', '大衣'], ['a blazer', 'Outerwear', '西裝外套'],
  ['a jacket', 'Outerwear', '夾克'], ['a cardigan', 'Outerwear', '開襟外套'],
  ['a pair of sneakers', 'Shoes', '休閒鞋'], ['a pair of boots', 'Shoes', '靴子'],
  ['a pair of sandals', 'Shoes', '涼鞋'], ['a handbag', 'Bags', '手提包'],
  ['a backpack', 'Bags', '背包'], ['a hat', 'Accessories', '帽子'],
  ['a pair of sunglasses', 'Accessories', '太陽眼鏡'],
  ['a scarf', 'Accessories', '圍巾'], ['a belt', 'Accessories', '皮帶'],
  ['several different pieces of clothing', null, null], ['something other than clothing', null, null],
];
export const clothingModel = { id:'Xenova/clip-vit-base-patch32', revision:'d15189d7028b43f1d3e65039190477f6af591c2a' };
export function garmentSuggestion(predictions) {
  const sorted=[...predictions].sort((a,b)=>b.score-a.score), best=sorted[0];
  if(!best || best.score<0.2) return null;
  const row=clothingVisionLabels.find(([label])=>label===best.label);
  // Similar shirt subtypes may disagree while the broader category is clear.
  // Never confidently change a trouser to a top when category scores are close.
  const rival=sorted.find(p=>clothingVisionLabels.find(([label])=>label===p.label)?.[1]!==row?.[1]);
  if(best.score-(rival?.score || 0)<0.05)return null;
  if(best.score-(sorted[1]?.score || 0)<0.05){
    const generic={Tops:'上衣',Bottoms:'下身',Dress:'洋裝',Outerwear:'外套',Shoes:'鞋履',Bags:'包款',Accessories:'配件'};
    return row?.[1]?{category:row[1],nameKey:generic[row[1]],needsReview:true}:null;
  }
  return row?.[1] ? {category:row[1],nameKey:row[2]} : null;
}
