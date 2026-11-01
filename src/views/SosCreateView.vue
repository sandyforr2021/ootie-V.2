<template>
  <section class="page active app-page sos-create-page" id="sosCreatePage">
    <router-link class="back-link" to="/sos">{{ $t("返回穿搭求救") }}</router-link>
    <header class="core-page-hero sos-page-hero sos-create-hero ootie-page-heading">
      <div>
        <h1>{{ t("請衣友幫忙搭配") }}</h1>
      </div>
    </header>
    <div class="sos-create-container">
      <SosFormContent />
    </div>
  </section>
</template>

<script setup>
import { t } from '@/i18n';
import SosFormContent from '@/components/sos/SosFormContent.vue';
</script>

<style scoped>
.sos-create-page { max-width: 760px; margin: 0 auto; padding: 24px 20px 80px; }
.sos-create-hero { margin: 16px 0 28px; }
.sos-create-hero h1 { font-family: var(--font-display, inherit); font-size: 28px; margin: 0; }
.sos-create-container { background: var(--surface-raised, #fff); border: 1px solid var(--line, #ece7ea); border-radius: 20px; padding: 32px 28px; box-shadow: var(--shadow-sm, 0 4px 16px rgba(0,0,0,0.03)); }
@media (max-width: 600px) {
  .sos-create-page { padding: 16px 14px 60px; }
  .sos-create-container { padding: 22px 16px; border-radius: 16px; }
}
</style>
