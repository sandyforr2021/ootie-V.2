<template>
  <div class="ai-view">
    <header class="hero">
      <div>
        <p class="eyebrow">OOTIE AI STYLIST</p>
        <h1>從你的衣櫥，找到今天的穿搭。</h1>
        <p class="hero-copy">AI 只會推薦你「我的衣櫥」中真實存在的單品，並依場合、風格、天氣與文字需求整理一套可直接預覽的組合。</p>
      </div>
      <div class="closet-count" aria-label="衣櫥單品數">
        <strong>{{ appStore.items.length }}</strong>
        <span>件私人衣物</span>
      </div>
    </header>

    <section v-if="!isMember" class="member-gate state-card">
      <span class="state-icon">✦</span>
      <div>
        <h2>登入後啟用私人 AI 穿搭助理</h2>
        <p>Gateway 會以你的 Supabase 身份重新確認衣物擁有權，訪客不會觸發付費 AI Request。</p>
      </div>
      <button type="button" class="primary-action" @click="openLoginGate">登入／註冊</button>
    </section>

    <div v-else class="workspace">
      <form class="brief-panel" @submit.prevent="generateRecommendation">
        <div class="section-heading">
          <span>01</span>
          <div>
            <h2>告訴 OOTIE 今天的需求</h2>
            <p>文字建議不會自動生成圖片。</p>
          </div>
        </div>

        <fieldset>
          <legend>場合</legend>
          <div class="chip-list">
            <button v-for="option in occasions" :key="option" type="button" :class="['choice-chip', { active: form.occasion === option }]" @click="form.occasion = option">{{ option }}</button>
          </div>
        </fieldset>

        <fieldset>
          <legend>想呈現的風格</legend>
          <div class="chip-list">
            <button v-for="option in styles" :key="option" type="button" :class="['choice-chip', { active: form.style === option }]" @click="form.style = option">{{ option }}</button>
          </div>
        </fieldset>

        <label class="field-label" for="weather">天氣資訊（若存在）</label>
        <select id="weather" v-model="form.weather" class="field-control">
          <option value="">未提供</option>
          <option v-for="option in weatherOptions" :key="option" :value="option">{{ option }}</option>
        </select>

        <label class="field-label" for="request">其他穿搭需求</label>
        <textarea id="request" v-model.trim="form.userRequest" class="field-control request-field" maxlength="600" placeholder="例如：下午有簡報，晚上要直接去約會；希望看起來俐落但不過度正式。"></textarea>

        <label class="field-label" for="item-limit">建議單品數：{{ form.itemLimit }} 件</label>
        <input id="item-limit" v-model.number="form.itemLimit" type="range" min="1" max="5" />

        <button type="submit" class="primary-action submit-action" :disabled="isLoading || appStore.items.length === 0">
          <span v-if="isLoading">正在整理你的衣櫥建議…</span>
          <span v-else>產生 AI 穿搭提案</span>
        </button>
        <p v-if="appStore.items.length === 0" class="inline-note">請先在「我的衣櫥」新增至少一件衣物。</p>
      </form>

      <section class="result-panel" aria-live="polite">
        <div class="section-heading">
          <span>02</span>
          <div>
            <h2>你的衣櫥提案</h2>
            <p>每個 clothing item ID 都會由 Gateway 再次驗證。</p>
          </div>
        </div>

        <div v-if="viewState === 'empty'" class="empty-state state-card">
          <span class="state-icon">↗</span>
          <div><h3>先完成左側穿搭 Brief</h3><p>OOTIE 會從你的私人衣櫥中選出一套組合，不會補上不存在的單品。</p></div>
        </div>

        <div v-else-if="viewState === 'loading'" class="state-card loading-state">
          <span class="spinner" aria-hidden="true"></span>
          <div><h3>正在分析衣物分類、顏色與需求…</h3><p>完成文字提案後仍不會自動產生付費圖片。</p></div>
        </div>

        <div v-else-if="viewState === 'error'" class="state-card error-state">
          <span class="state-icon">!</span>
          <div><h3>這次沒有取得可用提案</h3><p>{{ errorMessage }}</p></div>
          <button type="button" class="secondary-action" :disabled="isLoading" @click="generateRecommendation">手動重試</button>
        </div>

        <article v-else-if="recommendation" class="recommendation-card">
          <div class="recommendation-header">
            <div><p class="recommendation-kicker">{{ recommendation.occasion }} · {{ recommendation.style }}</p><h3>{{ recommendation.outfitTitle }}</h3></div>
            <span class="verified-badge">衣櫥已驗證</span>
          </div>
          <p class="recommendation-reason">{{ recommendation.reason }}</p>
          <p v-if="recommendation.weatherNote" class="weather-note">天氣提醒｜{{ recommendation.weatherNote }}</p>

          <div class="outfit-items">
            <article v-for="item in recommendation.items" :key="item.clothingItemId" class="outfit-item">
              <div class="item-image">
                <img v-if="item.clothingItem?.photo" :src="item.clothingItem.photo" :alt="item.clothingItem.name_zh || item.clothingItem.name" />
                <span v-else>NO IMAGE</span>
              </div>
              <div class="item-copy">
                <span class="item-role">{{ item.role }}</span>
                <h4>{{ item.clothingItem?.name_zh || item.clothingItem?.name }}</h4>
                <p>{{ item.reason }}</p>
                <button type="button" class="text-action" @click="openTryon('single', [item.clothingItemId])">以此單品虛擬試穿 →</button>
              </div>
            </article>
          </div>

          <div class="recommendation-actions">
            <button type="button" class="secondary-action" @click="resetRecommendation">修改需求</button>
            <button type="button" class="primary-action" @click="openTryon('outfit', recommendation.items.map((item) => item.clothingItemId))">用整套組合做 AI 穿搭預覽</button>
          </div>
        </article>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useClosetStore } from '@/stores/closet';
import { aiGateway, createGenerationId, getAiErrorMessage } from '@/services/aiGateway';

const router = useRouter();
const appStore = useAppStore();
const authStore = useAuthStore();
const closetStore = useClosetStore();
const isMember = computed(() => authStore.isMember);
const isLoading = ref(false);
const viewState = ref('empty');
const recommendation = ref(null);
const errorMessage = ref('');
const occasions = ['日常／上班', '重要簡報', '約會', '週末休閒', '戶外活動', '正式聚會'];
const styles = ['極簡俐落', '優雅柔和', '街頭層次', '日系清新', '復古質感'];
const weatherOptions = ['炎熱晴朗', '溫暖舒適', '微涼有風', '陰雨潮濕', '寒冷低溫'];
const form = reactive({ occasion: occasions[0], style: styles[0], weather: '', userRequest: '', itemLimit: 3 });

watch(() => authStore.profileId, (profileId) => {
  if (profileId) closetStore.loadRemoteItems(profileId);
}, { immediate: true });

const openLoginGate = () => appStore.openLoginGate('AUTH_REQUIRED', '/ai');

const generateRecommendation = async () => {
  if (isLoading.value) return;
  if (!isMember.value) return openLoginGate();
  if (!appStore.items.length) return;
  isLoading.value = true;
  viewState.value = 'loading';
  errorMessage.value = '';
  try {
    recommendation.value = await aiGateway.recommendOutfit(authStore.session?.access_token, {
      generationId: createGenerationId(),
      occasion: form.occasion,
      style: form.style,
      weather: form.weather,
      userRequest: form.userRequest,
      itemLimit: form.itemLimit
    });
    viewState.value = 'result';
  } catch (error) {
    recommendation.value = null;
    errorMessage.value = getAiErrorMessage(error);
    viewState.value = 'error';
  } finally {
    isLoading.value = false;
  }
};

const resetRecommendation = () => { recommendation.value = null; viewState.value = 'empty'; };
const openTryon = (mode, itemIds) => router.push({ name: 'Tryon', query: { mode, items: itemIds.join(',') } });
</script>

<style scoped>
.ai-view { max-width: 1180px; margin: 0 auto; padding-bottom: 64px; }
.hero { display: flex; justify-content: space-between; gap: 40px; align-items: flex-end; margin-bottom: 34px; }
.hero h1 { max-width: 720px; margin: 0; font-family: "Cormorant Garamond", serif; font-size: clamp(38px, 5vw, 64px); font-weight: 500; line-height: .98; letter-spacing: -1.5px; }
.hero-copy { max-width: 700px; margin: 20px 0 0; color: var(--muted); line-height: 1.75; }
.closet-count { min-width: 128px; padding: 20px; border: 1px solid var(--line); border-radius: 22px; background: var(--white); text-align: center; box-shadow: var(--shadow); }
.closet-count strong { display: block; font-family: "Cormorant Garamond", serif; font-size: 40px; color: var(--sage-dark); }
.closet-count span { color: var(--muted); font-size: 12px; }
.workspace { display: grid; grid-template-columns: minmax(300px, .82fr) minmax(0, 1.45fr); gap: 24px; align-items: start; }
.brief-panel, .result-panel { background: var(--white); border: 1px solid var(--line); border-radius: 24px; padding: clamp(22px, 3vw, 32px); }
.brief-panel { display: grid; gap: 22px; position: sticky; top: 24px; }
.section-heading { display: flex; gap: 14px; align-items: flex-start; }
.section-heading > span { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: #edf0e9; color: var(--sage-dark); font-size: 11px; font-weight: 700; letter-spacing: 1px; }
.section-heading h2 { margin: 0; font-size: 20px; }
.section-heading p { margin: 5px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
fieldset { padding: 0; margin: 0; border: 0; }
legend, .field-label { display: block; margin-bottom: 10px; color: var(--ink); font-size: 13px; font-weight: 700; }
.chip-list { display: flex; flex-wrap: wrap; gap: 8px; }
.choice-chip { border: 1px solid var(--line); background: var(--paper); border-radius: 999px; padding: 8px 12px; color: var(--muted); font-size: 12px; }
.choice-chip.active { border-color: var(--sage-dark); background: var(--sage-dark); color: #fff; }
.field-control { width: 100%; border: 1px solid var(--line); border-radius: 13px; padding: 12px 14px; background: #fbfaf7; color: var(--ink); }
.request-field { min-height: 110px; resize: vertical; line-height: 1.6; }
input[type="range"] { width: 100%; accent-color: var(--sage-dark); }
.primary-action, .secondary-action { border-radius: 999px; padding: 12px 18px; font-weight: 700; border: 1px solid var(--sage-dark); }
.primary-action { background: var(--sage-dark); color: #fff; }
.primary-action:disabled { opacity: .48; cursor: not-allowed; }
.secondary-action { background: transparent; color: var(--sage-dark); }
.submit-action { width: 100%; min-height: 48px; }
.inline-note { margin: -12px 0 0; color: #9a635e; font-size: 12px; text-align: center; }
.result-panel { min-height: 590px; }
.state-card { border: 1px dashed #d8d5cc; border-radius: 18px; padding: 28px; display: flex; gap: 18px; align-items: center; background: #fbfaf7; }
.result-panel > .state-card { min-height: 410px; justify-content: center; text-align: left; }
.state-card h2, .state-card h3 { margin: 0 0 8px; }
.state-card p { margin: 0; color: var(--muted); line-height: 1.6; }
.state-icon { flex: 0 0 auto; display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; background: #e8ede5; color: var(--sage-dark); font-size: 22px; }
.member-gate { justify-content: space-between; }
.member-gate > div { flex: 1; }
.spinner { width: 36px; height: 36px; border: 3px solid #dde2d9; border-top-color: var(--sage-dark); border-radius: 50%; animation: spin .85s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.error-state { border-style: solid; border-color: #ead4d1; background: #fff9f8; }
.error-state .state-icon { background: #f3dfdc; color: #9a635e; }
.recommendation-card { margin-top: 26px; }
.recommendation-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.recommendation-kicker { margin: 0 0 6px; color: var(--sage-dark); font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 700; }
.recommendation-header h3 { margin: 0; font-family: "Cormorant Garamond", serif; font-size: 36px; font-weight: 600; }
.verified-badge { flex: 0 0 auto; border-radius: 999px; padding: 7px 10px; background: #edf0e9; color: var(--sage-dark); font-size: 11px; font-weight: 700; }
.recommendation-reason { color: var(--muted); line-height: 1.75; }
.weather-note { border-left: 3px solid var(--sage); padding: 8px 12px; background: #f7f8f4; color: var(--sage-dark); font-size: 13px; }
.outfit-items { display: grid; gap: 12px; margin-top: 22px; }
.outfit-item { display: grid; grid-template-columns: 104px 1fr; gap: 18px; border-top: 1px solid var(--line); padding-top: 14px; }
.item-image { width: 104px; height: 116px; border-radius: 14px; overflow: hidden; background: var(--paper); display: grid; place-items: center; color: var(--muted); font-size: 10px; }
.item-image img { width: 100%; height: 100%; object-fit: contain; }
.item-copy { min-width: 0; }
.item-role { color: var(--sage-dark); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; }
.item-copy h4 { margin: 5px 0; font-size: 16px; }
.item-copy p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.55; }
.text-action { margin-top: 8px; padding: 0; border: 0; background: transparent; color: var(--sage-dark); font-size: 12px; font-weight: 700; }
.recommendation-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 26px; padding-top: 22px; border-top: 1px solid var(--line); }
@media (max-width: 900px) { .workspace { grid-template-columns: 1fr; } .brief-panel { position: static; } .hero { align-items: flex-start; } }
@media (max-width: 620px) { .hero { display: block; } .closet-count { display: inline-flex; gap: 8px; align-items: baseline; margin-top: 20px; padding: 10px 16px; } .closet-count strong { font-size: 28px; } .member-gate, .recommendation-actions { align-items: stretch; flex-direction: column; } .outfit-item { grid-template-columns: 84px 1fr; } .item-image { width: 84px; height: 100px; } }

/* Presentation consistency: Home-inspired product workspace */
.hero {
  position: relative;
  padding: clamp(24px, 4vw, 44px);
  border: 1px solid rgba(244, 169, 189, .34);
  border-radius: 28px;
  background:
    radial-gradient(circle at 88% 18%, rgba(247, 221, 105, .55) 0 9%, transparent 10%),
    linear-gradient(125deg, var(--accent-pink-soft), var(--accent-yellow-soft) 58%, var(--accent-blue-soft));
  box-shadow: var(--shadow-soft);
  overflow: hidden;
}
.hero::after { content: "style note ♡"; position: absolute; right: 28px; bottom: 16px; color: var(--accent-violet-ink); font-size: 12px; font-weight: 700; letter-spacing: .8px; transform: rotate(-4deg); opacity: .72; }
.hero h1 { font-family: "DM Sans", sans-serif; font-weight: 800; letter-spacing: -2.4px; }
.hero-copy { color: #5d5860; }
.closet-count { border-color: rgba(200, 183, 239, .72); background: rgba(255, 255, 255, .82); box-shadow: var(--shadow-soft); }
.closet-count strong { font-family: "DM Sans", sans-serif; color: var(--ink); font-weight: 800; }
.workspace { margin-top: 26px; }
.brief-panel, .result-panel { border-radius: 26px; background: rgba(255, 255, 255, .88); box-shadow: var(--shadow-soft); }
.section-heading > span { background: var(--accent-yellow-soft); color: var(--ink); }
.choice-chip { transition: transform .18s ease, border-color .18s ease, background .18s ease; }
.choice-chip:hover { transform: translateY(-1px); border-color: var(--accent-pink); background: var(--accent-pink-soft); }
.choice-chip.active { border-color: var(--ink); background: var(--ink); }
.field-control { background: var(--surface-raised); }
.field-control:focus { border-color: var(--accent-violet-ink); box-shadow: 0 0 0 3px rgba(200, 183, 239, .28); outline: none; }
input[type="range"] { accent-color: var(--ink); }
.primary-action, .secondary-action { min-height: 44px; border-color: var(--ink); border-radius: var(--radius-control); transition: transform .18s ease, box-shadow .18s ease, background .18s ease; }
.primary-action { background: var(--ink); box-shadow: 0 8px 18px rgba(29, 28, 31, .14); }
.primary-action:not(:disabled):hover { transform: translateY(-2px); box-shadow: var(--shadow-hover); }
.secondary-action { background: var(--white); color: var(--ink); }
.secondary-action:not(:disabled):hover { background: var(--accent-yellow-soft); transform: translateY(-1px); }
.state-card { border-color: rgba(169, 216, 242, .7); background: linear-gradient(135deg, var(--accent-blue-soft), rgba(255,255,255,.92)); }
.state-icon { background: var(--accent-yellow-soft); color: var(--ink); }
.error-state { border-color: rgba(244,169,189,.65); background: var(--accent-pink-soft); }
.error-state .state-icon { background: #ffe0e8; color: #8d4057; }
.recommendation-kicker, .item-role, .text-action { color: var(--accent-violet-ink); }
.recommendation-header h3 { font-family: "DM Sans", sans-serif; font-weight: 800; letter-spacing: -1px; }
.verified-badge { background: var(--accent-lavender-soft); color: var(--accent-violet-ink); }
.weather-note { border-left-color: var(--accent-blue); background: var(--accent-blue-soft); color: #35546a; }
.outfit-item { border-radius: 18px; border: 1px solid var(--line); padding: 12px; background: var(--paper); }
.item-image { background: var(--white); }
@media (max-width: 620px) {
  .hero { padding: 24px 20px 52px; border-radius: 22px; }
  .hero::after { right: 18px; bottom: 15px; }
  .hero h1 { font-size: 40px; letter-spacing: -1.6px; }
  .brief-panel, .result-panel { padding: 20px; border-radius: 22px; }
}
</style>
