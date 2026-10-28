<template>
  <section class="page active legal-page" aria-labelledby="legal-title">
    <router-link class="legal-back" to="/settings">{{ t('← 返回帳號設定','← Back to account settings') }}</router-link>
    <article>

      <h1 id="legal-title">{{ content.title }}</h1>
      <p class="legal-draft">{{ t('文件草案 · 尚未經法律專業人員審閱','Draft · Not yet reviewed by legal counsel') }}</p>
      <p class="legal-lead">{{ content.intro }}</p>
      <section v-for="section in content.sections" :key="section.title">
        <h2>{{ section.title }}</h2>
        <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
      </section>
      <p class="legal-updated">{{ t('更新日期：2026 年 10 月 23 日（Development Preview）','Updated October 23, 2026 (Development Preview)') }}</p>
    </article>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { t } from '@/i18n';

const route = useRoute();
const documents = {
  privacy: {
    title: ['隱私權說明','Privacy notice'],
    intro: ['本頁說明 OOTIE 開發預覽環境中，各類資料如何被使用與區分；它不是正式法律意見。','This notice explains how data is used in the OOTIE development preview. It is not legal advice.'],
    sections: [
      { title: ['公開與私人資料','Public and private data'], paragraphs: [
        ['公開 OOTD、公開 SOS 與公開個人檔案欄位可供其他使用者瀏覽。Email、生日、電話、天氣城市、私人衣櫥、AI 人物照與 AI 生成結果僅供本人存取。','Public OOTD posts, public SOS posts, and selected profile fields can be viewed by others. Email, birth date, phone number, city preference, private wardrobe, person photos, and AI results are available only to you.']
      ] },
      { title: ['第三方服務與照片處理','Third-party services and photo processing'], paragraphs: [
        ['登入與資料由 Supabase 提供。OOTIE 的試穿與色彩分析會在你同意後，將本次選用的照片交由影像處理服務供應商處理；這不會把私人照片自動公開。','Supabase provides sign-in and data storage. After you consent, OOTIE sends only the photo selected for that try-on or color analysis to its image-processing provider. This does not make your private photo public.']
      ] },
      { title: ['刪除與撤回','Deletion and withdrawal'], paragraphs: [
        ['你可以刪除已上傳的人物照、刪除試穿結果，或撤回已公開的分享。人物照若仍被等待中或待核對工作使用，系統會先阻止刪除。刪除結果會移除圖片與公開分享；為了額度核對及避免重複提交，工作編號、狀態與點數紀錄可能保留。','You can delete uploaded person photos and try-on results, or retract a public post. A photo cannot be deleted while a queued or unresolved job uses it. Deleting a result removes its image and public post. The job ID, status, and credit record may remain for accounting and duplicate prevention.']
      ] },
      { title: ['你的選擇','Your choices'], paragraphs: [
        ['你可以編輯個人資料、登出，並透過帳號設定管理目前支援的偏好。正式上線前仍需補充資料保存期間與聯絡窗口等法律條款。','You can edit your profile, sign out, and manage supported preferences in account settings. Data retention periods and a contact channel still need to be added before a production launch.']
      ] }
    ]
  },
  terms: {
    title: ['使用條款','Terms of use'],
    intro: ['這是產品結構草案，用於說明預期的使用規則；正式服務條款需在上線前由法律專業人員審閱。','This draft describes the intended product rules. Formal service terms should be reviewed by legal counsel before launch.'],
    sections: [
      { title: ['使用內容','User content'], paragraphs: [
        ['使用者應僅上傳有權使用的照片與內容，且不得冒用他人身分、侵害隱私或發布違法內容。','Upload only photos and content you have permission to use. Do not impersonate others, violate privacy, or post unlawful material.']
      ] },
      { title: ['服務狀態','Service availability'], paragraphs: [
        ['目前為 Development Preview，功能、資料與可用性可能調整。方案與點數操作不代表真實付款或扣款。','This is a development preview. Features, data, and availability may change. Plan and credit displays do not represent a real payment or charge.']
      ] },
      { title: ['第三方來源','Third-party sources'], paragraphs: [
        ['外部商品資料以來源頁面提供的資訊為準；OOTIE 不保證第三方頁面的價格、庫存或內容持續有效。','External product details come from their source pages. OOTIE does not guarantee that third-party prices, stock, or content remain current.']
      ] }
    ]
  },
  ai: {
    title: ['AI 圖像使用說明','AI image guidance'],
    intro: ['OOTIE 的 AI 圖像用來協助探索穿搭方向，不是尺寸、版型或材質的精準保證。','OOTIE AI images help you explore outfit ideas. They do not guarantee size, fit, or material.'],
    sections: [
      { title: ['視覺模擬限制','Limits of visual simulation'], paragraphs: [
        ['虛擬試穿與 AI 穿搭預覽皆為視覺模擬，實際版型、尺寸、材質、色差與穿著效果可能不同。請勿僅依生成圖片做高風險或高金額決策。','Virtual try-on and AI outfit previews are visual simulations. Actual fit, size, material, color, and appearance may differ. Do not rely on a generated image alone for a high-risk or high-cost decision.']
      ] },
      { title: ['人物照與結果','Person photos and results'], paragraphs: [
        ['人物照及 AI 結果儲存在私人空間；只有本人可在授權範圍內讀取。只有使用者主動發布後，分享結果才會公開。','Person photos and AI results are stored privately and are accessible only to you through your account. A result becomes public only when you choose to publish it.']
      ] },
      { title: ['安全與錯誤','Safety and errors'], paragraphs: [
        ['請勿上傳無權使用、敏感或不適當的影像。AI 可能拒絕部分內容，也可能產生不準確或不自然的結果。','Do not upload images you are not authorized to use, or images that are sensitive or inappropriate. AI may reject some content and may produce inaccurate or unnatural results.']
      ] }
    ]
  }
};
const content = computed(() => {
  const document = documents[route.params.document] || documents.privacy;
  const translate = ([zh, en]) => t(zh, en);
  return {
    title: translate(document.title),
    intro: translate(document.intro),
    sections: document.sections.map((section) => ({
      title: translate(section.title),
      paragraphs: section.paragraphs.map(translate)
    }))
  };
});
</script>

<style scoped>
.legal-page{max-width:920px}.legal-back{display:inline-flex;margin-bottom:24px;color:var(--accent-violet-ink);font-weight:750}.legal-page article{padding:clamp(24px,5vw,56px);border-radius:var(--radius-card);background:var(--surface-raised);box-shadow:var(--shadow-soft)}.legal-page h1{margin:0;font-size:clamp(38px,6vw,68px);letter-spacing:-.04em}.legal-draft{display:inline-flex;margin:16px 0;padding:7px 11px;border-radius:999px;background:var(--accent-yellow-soft);font-size:12px;font-weight:800}.legal-lead{max-width:68ch;color:var(--muted);font-size:18px;line-height:1.8}.legal-page section{margin-top:34px}.legal-page h2{font-size:22px}.legal-page section p{max-width:72ch;color:#49454d;line-height:1.85}.legal-updated{margin-top:48px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
</style>
