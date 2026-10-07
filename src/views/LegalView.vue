<template>
  <section class="page active legal-page" aria-labelledby="legal-title">
    <router-link class="legal-back" to="/settings">← 返回帳號設定</router-link>
    <article>
      <p class="eyebrow">OOTie Information</p>
      <h1 id="legal-title">{{ content.title }}</h1>
      <p class="legal-draft">文件草案 · 尚未經法律專業人員審閱</p>
      <p class="legal-lead">{{ content.intro }}</p>
      <section v-for="section in content.sections" :key="section.title">
        <h2>{{ section.title }}</h2>
        <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
      </section>
      <p class="legal-updated">更新日期：2026 年 10 月 1 日（Development Preview）</p>
    </article>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const documents = {
  privacy: {
    title: '隱私權說明',
    intro: '本頁說明 OOTIE 開發預覽環境中，各類資料如何被使用與區分；它不是正式法律意見。',
    sections: [
      { title: '公開與私人資料', paragraphs: ['公開 OOTD、公開 SOS 與公開個人檔案欄位可供其他使用者瀏覽。Email、生日、電話、天氣城市、私人衣櫥、AI 人物照與 AI 生成結果預設只對本人開放。'] },
      { title: '第三方服務', paragraphs: ['登入與資料由 Supabase 提供；AI 推論由 Google Cloud 開發資源處理。外部商品書籤保留來源網址與網域，以便辨識來源。'] },
      { title: '你的選擇', paragraphs: ['你可以編輯個人資料、登出，並透過帳號設定管理目前支援的偏好。正式上線前仍需補充資料保存、刪除與聯絡窗口等法律條款。'] }
    ]
  },
  terms: {
    title: '使用條款',
    intro: '這是產品結構草案，用於說明預期的使用規則；正式服務條款需在上線前由法律專業人員審閱。',
    sections: [
      { title: '使用內容', paragraphs: ['使用者應僅上傳有權使用的照片與內容，且不得冒用他人身分、侵害隱私或發布違法內容。'] },
      { title: '服務狀態', paragraphs: ['目前為 Development Preview，功能、資料與可用性可能調整。方案與點數操作不代表真實付款或扣款。'] },
      { title: '第三方來源', paragraphs: ['外部商品資料以來源頁面提供的資訊為準；OOTIE 不保證第三方頁面的價格、庫存或內容持續有效。'] }
    ]
  },
  ai: {
    title: 'AI 圖像使用說明',
    intro: 'OOTIE 的 AI 圖像用來協助探索穿搭方向，不是尺寸、版型或材質的精準保證。',
    sections: [
      { title: '視覺模擬限制', paragraphs: ['虛擬試穿與 AI 穿搭預覽皆為視覺模擬，實際版型、尺寸、材質、色差與穿著效果可能不同。請勿僅依生成圖片做高風險或高金額決策。'] },
      { title: '人物照與結果', paragraphs: ['人物照及 AI 結果預設儲存在私人空間；只有本人可在授權範圍內讀取。使用者主動發布公開內容前，不會自動轉為公開素材。'] },
      { title: '安全與錯誤', paragraphs: ['請勿上傳無權使用、敏感或不適當的影像。AI 可能拒絕部分內容，也可能產生不準確或不自然的結果。'] }
    ]
  }
};
const content = computed(() => documents[route.params.document] || documents.privacy);
</script>

<style scoped>
.legal-page{max-width:920px}.legal-back{display:inline-flex;margin-bottom:24px;color:var(--accent-violet-ink);font-weight:750}.legal-page article{padding:clamp(24px,5vw,56px);border-radius:var(--radius-card);background:var(--surface-raised);box-shadow:var(--shadow-soft)}.legal-page h1{margin:0;font-size:clamp(38px,6vw,68px);letter-spacing:-.04em}.legal-draft{display:inline-flex;margin:16px 0;padding:7px 11px;border-radius:999px;background:var(--accent-yellow-soft);font-size:12px;font-weight:800}.legal-lead{max-width:68ch;color:var(--muted);font-size:18px;line-height:1.8}.legal-page section{margin-top:34px}.legal-page h2{font-size:22px}.legal-page section p{max-width:72ch;color:#49454d;line-height:1.85}.legal-updated{margin-top:48px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
</style>
