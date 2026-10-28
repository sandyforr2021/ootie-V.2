import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { LANGUAGES, initialLocale, setLocale, locale, t, translateFor, formatDate } from '../index';
import { messages } from '../messages';

afterEach(()=>setLocale('zh-TW'));
describe('four-language product experience',()=>{
  it('defaults to English and only accepts supported saved/query languages',()=>{
    expect(initialLocale({getItem:()=>null},'')).toBe('en');
    expect(initialLocale({getItem:()=> 'ja'},'')).toBe('ja');
    expect(initialLocale({getItem:()=> 'ja'},'?lang=es')).toBe('es');
    expect(initialLocale({getItem:()=> 'invalid'},'?lang=invalid')).toBe('en');
    expect(initialLocale({getItem:()=>{throw new Error('restricted');}},'')).toBe('en');
    expect(initialLocale({getItem:()=>null},'?lang=zh')).toBe('zh-TW');
  });
  it('switches mounted UI immediately, persists choice and updates document language',async()=>{
    setLocale('en');const wrapper=mount({setup:()=>({t}),template:'<button>{{ t("送出試穿工作") }}</button>'});
    expect(wrapper.text()).toBe('Queue try-ons');setLocale('ja');await nextTick();
    expect(wrapper.text()).toBe('試着を開始');expect(document.documentElement.lang).toBe('ja');
    expect(localStorage.getItem('ootie-language')).toBe('ja');
    expect(setLocale('arbitrary')).toBe(false);expect(locale.value).toBe('ja');wrapper.unmount();
  });
  it('covers every shop message and consent statement in all four languages',()=>{
    const source=['ShopView.vue','CreditView.vue'].map(file=>readFileSync(resolve(process.cwd(),'src/views',file),'utf8')).join('\n');
    const keys=[...source.matchAll(/\btf?\('([^']+)'/g)].map(m=>m[1]);
    for(const key of keys) for(const language of LANGUAGES) expect(messages[key]?.[language.code],`${key}/${language.code}`).toBeTruthy();
    for(const entry of Object.values(messages)) for(const {code} of LANGUAGES) expect(entry[code]).toBeTruthy();
    expect(translateFor('es','私人相簿')).toBe('Álbum privado');
  });
  it('formats dates using the selected language and never rewrites user content',()=>{
    setLocale('es');expect(formatDate('2026-10-22T12:00:00Z',{month:'long',timeZone:'UTC'})).toBe('octubre');
    expect(t('My own product name')).toBe('My own product name');expect(formatDate('bad')).toBe('');
  });
  it('translates upload lifecycle, warnings, color labels and point rules',()=>{
    const keys=['正在檢查照片…','正在取消…','單品照片預覽','建議確認','清晰可用','請確認品名與分類。','無法確定分類，請自行選擇。','白色','丹寧藍','單件 2 點，三件整套 6 點。','免費去背與品名辨識不扣點。'];
    const mediaSource=readFileSync(resolve(process.cwd(),'src/services/clothingMedia.js'),'utf8');
    keys.push(...[...mediaSource.matchAll(/(?:message: |new Error\()'([^']+)'/g)].map(m=>m[1]));
    for(const key of keys) for(const {code} of LANGUAGES) expect(messages[key]?.[code],`${key}/${code}`).toBeTruthy();
  });
});
