import { describe, expect, it } from 'vitest';
import { defaultCurrency, formatMoney, validPurchaseAmount, wardrobeCosts } from '../money';

describe('wardrobe money', () => {
  it('uses language only for new purchase defaults and display formatting', () => {
    expect(['en','zh-TW','ja','es'].map(defaultCurrency)).toEqual(['USD','TWD','JPY','EUR']);
    expect(formatMoney(1000,'TWD','en')).toContain('TWD');
    expect(formatMoney(1000,'TWD','ja')).toContain('1,000');
    expect(formatMoney(99.5,'USD','es')).toContain('99,50');
  });
  it('separates currencies, preserves legacy TWD, and excludes unknown prices from totals', () => {
    const groups = wardrobeCosts([
      { id:'a',price:1000,wear_count:4 },
      { id:'b',price:99.95,currency:'USD',wear_count:5 },
      { id:'c',price:null,currency:'USD',wear_count:10 },
      { id:'d',price:0,currency:'USD',wear_count:1 },
      { id:'e',price:99999,currency:'USD',hidden:true }
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({currency:'TWD',total:1000,priced:1});
    expect(groups[0].rows[0].costPerWear).toBe(250);
    expect(groups[1]).toMatchObject({currency:'USD',total:99.95,priced:2,unknown:1,wears:6});
    expect(groups[1].rows[1].costPerWear).toBeNull();
    expect(groups[1].rows[2].costPerWear).toBe(0);
  });
  it('does not treat unworn or missing prices as zero cost', () => {
    const group = wardrobeCosts([{price:500,wear_count:0},{price:'',wear_count:3}])[0];
    expect(group.unworn).toBe(1);
    expect(group.unknown).toBe(1);
    expect(group.rows.every(item=>item.costPerWear===null)).toBe(true);
  });
  it('validates cents and zero-decimal currencies without silent rounding', () => {
    expect(validPurchaseAmount(99.95,'USD')).toBe(true);
    expect(validPurchaseAmount(99.951,'USD')).toBe(false);
    expect(validPurchaseAmount(1000.5,'JPY')).toBe(false);
    expect(validPurchaseAmount(1000,'JPY')).toBe(true);
    expect(validPurchaseAmount(-1,'EUR')).toBe(false);
    expect(validPurchaseAmount(0,'TWD')).toBe(true);
  });
});
