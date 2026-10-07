<template>
  <section class="page active not-found-page" aria-labelledby="not-found-title">
    <div class="not-found-card">
      <p class="eyebrow">404 · LOST OUTFIT</p>
      <span class="not-found-mark" aria-hidden="true">?</span>
      <h1 id="not-found-title">這一頁不在衣櫥裡</h1>
      <p>連結可能已更新或內容已移除。你可以回到首頁，或繼續探索公開穿搭。</p>
      <div class="not-found-actions">
        <router-link class="primary" to="/">返回首頁</router-link>
        <router-link class="secondary" to="/explore">探索 OOTD</router-link>
      </div>
    </div>
  </section>
</template>

<style scoped>
.not-found-page{min-height:calc(100dvh - 100px);display:grid;place-items:center}.not-found-card{width:min(680px,100%);padding:clamp(30px,7vw,72px);text-align:center;border:1px solid var(--line);border-radius:var(--radius-card);background:radial-gradient(circle at 16% 12%,var(--accent-yellow-soft),transparent 34%),radial-gradient(circle at 86% 85%,var(--accent-blue-soft),transparent 36%),var(--surface-raised);box-shadow:var(--shadow-soft)}.not-found-mark{display:grid;place-items:center;width:76px;height:76px;margin:18px auto;border-radius:24px;background:var(--accent-pink-soft);font-family:"Playfair Display",serif;font-size:42px}.not-found-card h1{margin:0;font-size:clamp(38px,7vw,72px);letter-spacing:-.05em}.not-found-card>p:not(.eyebrow){max-width:46ch;margin:18px auto 28px;color:var(--muted);line-height:1.75}.not-found-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}.not-found-actions a{min-height:48px;display:inline-flex;align-items:center;justify-content:center;padding:0 22px}@media(max-width:480px){.not-found-card{padding:30px 20px}.not-found-actions{display:grid}.not-found-actions a{width:100%}}
</style>
