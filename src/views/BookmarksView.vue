<template>
  <SavedOutfitsCollection v-if="route.query.tab === 'outfits'" />
  <section v-else class="page active bookmarks-page">
    <header class="core-page-hero bookmarks-page-hero">
      <div>
        <h1>{{ $t("書籤") }}</h1>
        <p class="intro">{{ $t("把想買或想再看的商品先存起來，等下一次想穿、想買時能直接找到。") }}</p>
      </div>
      <p class="core-page-note" aria-hidden="true">save now<br />style later ♡</p>
    </header>

    <section class="product-import-panel" aria-labelledby="product-import-title">
      <div>
        <h2 id="product-import-title">{{ $t("貼上商品網址") }}</h2>
        <p>{{ $t("OOTIE 會從商品頁讀取可公開取得的結構化資料；辨識不到的欄位可由你手動補上。") }}</p>
      </div>
      <form class="product-import-form" @submit.prevent="handleProductPreview">
        <label class="sr-only" for="productImportUrl">商品網址</label>
        <input id="productImportUrl" v-model="importUrl" type="url" required placeholder="https://brand.example/product/..." />
        <button class="primary" type="submit" :disabled="importLoading">{{ importLoading ? $t('讀取中…') : $t('讀取商品') }}</button>
      </form>
      <p v-if="importError" class="import-error" role="alert">{{ importError }}</p>
      <div v-if="importPreview" class="import-preview" role="status">
        <img v-if="importPreview.image" :src="importPreview.image" :alt="importPreview.title || '商品預覽'" />
        <div v-else class="import-preview-missing" aria-label="商品頁沒有可用圖片">＋<small>稍後補圖</small></div>
        <div>
          <span>{{ importPreview.brand || importPreview.sourceDomain }}</span>
          <strong>{{ importPreview.title || '尚未辨識商品名稱' }}</strong>
          <small>{{ importPreview.sourceDomain }} · {{ parserLabel(importPreview.parser) }}</small>
          <small v-if="!importPreview.image" class="image-needed">商品頁未提供可用圖片，確認後可手動加入。</small>
        </div>
        <button class="secondary" type="button" @click="confirmImportedProduct">使用此商品</button>
      </div>
      <button v-if="importError" class="text-button" type="button" @click="openManualImport">改用手動輸入</button>
    </section>

    <!-- 工具列 -->
    <div class="bookmarks-toolbar">
      <div class="bookmarks-actions">
        <button
          class="secondary ext-btn"
          type="button"
          @click="bookmarksStore.isExtensionGuideOpen = true"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>安裝擴充功能</span>
        </button>
        <button
          :class="['secondary', { selected: bookmarksStore.isManagerMode }]"
          type="button"
          @click="bookmarksStore.toggleManagerMode()"
        >
          {{ bookmarksStore.isManagerMode ? '完成' : '管理' }}
        </button>
        <button class="primary" type="button" @click="handleOpenCreateModal()">
          ＋ 建立書籤
        </button>
      </div>
    </div>

    <!-- 批次管理工具列 -->
    <div v-if="bookmarksStore.isManagerMode" class="bookmark-manager-bar">
      <span>已選 {{ bookmarksStore.selectedBookmarkIds.length }}{{ $t("件") }}</span>
      <button
        class="danger"
        type="button"
        :disabled="bookmarksStore.selectedBookmarkIds.length === 0"
        @click="handleBatchDelete()"
      >
        刪除已選
      </button>
    </div>

    <!-- 書籤卡片網格 -->
    <div class="bookmarks-grid">
      <div v-if="bookmarksStore.sortedBookmarks.length === 0" class="empty bookmark-empty">
        <h3>還沒有書籤</h3>
        <p>把想要的商品網址貼進來，先存住好物。</p>
        <button class="primary" type="button" @click="handleOpenCreateModal()">
          建立書籤
        </button>
      </div>

      <article
        v-for="(bookmark, index) in bookmarksStore.sortedBookmarks"
        :key="bookmark.id"
        :class="['bookmark-card', { selected: bookmarksStore.selectedBookmarkIds.includes(bookmark.id) }]"
        :style="{ animationDelay: `${index * 40}ms` }"
        @click="handleCardClick(bookmark.id)"
      >
        <div class="bookmark-image-wrap">
          <!-- 管理模式勾選框 -->
          <label
            v-if="bookmarksStore.isManagerMode"
            class="bookmark-select"
            @click.stop
          >
            <input
              type="checkbox"
              :checked="bookmarksStore.selectedBookmarkIds.includes(bookmark.id)"
              @change="bookmarksStore.toggleSelectBookmark(bookmark.id)"
            />
          </label>

          <!-- 外部商品連結快捷鈕 -->
          <button
            v-else-if="bookmark.product_url"
            type="button"
            class="bookmark-card-link"
            :aria-label="`前往 ${bookmark.title}`"
            @click.stop="handleOpenExternalLink(bookmark.product_url)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>

          <!-- 商品圖片或預設佔位 -->
          <img
            v-if="bookmark.image_url"
            :src="bookmark.image_url"
            :alt="bookmark.title"
            loading="lazy"
            @error="handleImageError"
          />
          <div class="card-no-image-placeholder" :style="{ display: bookmark.image_url ? 'none' : 'flex' }">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>暫無圖片</span>
          </div>
        </div>

        <div class="bookmark-info">
          <h3>{{ bookmark.title }}</h3>
          <p>{{ getBookmarkMetaText(bookmark) }}</p>
        </div>
      </article>
    </div>

    <!-- 建立 / 編輯書籤 Modal (橫式雙欄大圖配置) -->
    <div
      v-if="bookmarksStore.isFormModalOpen"
      class="modal-backdrop open"
      @click.self="bookmarksStore.closeFormModal()"
    >
      <section v-accessible-modal class="modal bookmark-form-modal">
        <button
          class="modal-close"
          type="button"
          :aria-label="$t(&quot;關閉&quot;)"
          @click="bookmarksStore.closeFormModal()"
        >
          ×
        </button>
        <div class="bookmark-form-layout">
          <!-- 左側：大尺寸 4:5 預覽卡片 -->
          <div class="bookmark-form-left">
            <div class="bookmark-preview-box">
              <div v-show="!previewImageSrc" class="preview-placeholder">
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <span>尚未加入商品圖片</span>
                <small>請在右側輸入網址或選取檔案</small>
              </div>
              <img
                v-show="previewImageSrc"
                :src="previewImageSrc"
                alt="商品預覽"
                @error="previewImageSrc = ''"
              />
            </div>
          </div>

          <!-- 右側：輸入欄位 -->
          <div class="bookmark-form-right">
            <h2>{{ bookmarksStore.formMode === 'edit' ? '編輯書籤' : '建立書籤' }}</h2>
            <form @submit.prevent="handleSubmitForm">
              <div class="form-grid">
                <div class="form-field full">
                  <label for="bmTitle">商品名稱 *</label>
                  <input
                    id="bmTitle"
                    v-model="formData.title"
                    required
                    placeholder="例如：The Ilana Cardigan"
                  />
                </div>

                <div class="form-field full">
                  <label for="bmUrl">商品頁網址</label>
                  <input
                    id="bmUrl"
                    v-model="formData.product_url"
                    type="url"
                    placeholder="https://example.com/product/..."
                  />
                </div>

                <!-- 圖片來源：網址 + 本機上傳檔案 -->
                <div class="form-field full">
                  <label for="bmImageUrl">商品圖片 (輸入網址或選取檔案)</label>
                  <div class="combined-image-field">
                    <input
                      id="bmImageUrl"
                      v-model="formData.image_url"
                      type="url"
                      placeholder="貼上圖片網址 https://..."
                      @input="onImageUrlInput"
                    />
                    <label class="file-upload-badge" title="從電腦選擇圖片檔案">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <span>選取檔案</span>
                      <input
                        type="file"
                        accept="image/*"
                        @change="handleFileUpload"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <!-- 補充更多折疊區 -->
              <div class="bookmark-extra-controls">
                <button
                  type="button"
                  class="text-button"
                  @click="isExtraFieldsExpanded = !isExtraFieldsExpanded"
                >
                  {{ isExtraFieldsExpanded ? '▴ 收合補充資訊' : '▾ 補充更多 (品牌、尺寸、價格等)' }}
                </button>
              </div>

              <div v-show="isExtraFieldsExpanded" class="form-grid">
                <div class="form-field">
                  <label for="bmBrand">{{ $t("品牌") }}</label>
                  <input id="bmBrand" v-model="formData.brand" placeholder="例如：Aritzia" />
                </div>

                <div class="form-field">
                  <label for="bmVariant">款式 / 分類</label>
                  <input id="bmVariant" v-model="formData.variant_name" placeholder="例如：Caramel beige / 連帽款" />
                </div>

                <div class="form-field">
                  <label for="bmColor">顏色</label>
                  <input id="bmColor" v-model="formData.color" placeholder="例如：Beige / 黑色" />
                </div>

                <div class="form-field">
                  <label for="bmSize">尺寸</label>
                  <input id="bmSize" v-model="formData.size" placeholder="例如：M / 38" />
                </div>

                <div class="form-field">
                  <label for="bmPrice">價格</label>
                  <input id="bmPrice" v-model="formData.price" placeholder="例如：3990" />
                </div>

                <div class="form-field">
                  <label for="bmCurrency">貨幣</label>
                  <select id="bmCurrency" v-model="formData.currency">
                    <option value="TWD">TWD</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="JPY">JPY</option>
                  </select>
                </div>

                <div class="form-field full">
                  <label for="bmNotes">{{ $t("備註") }}</label>
                  <input id="bmNotes" v-model="formData.notes" placeholder="例如：想等週末特價再買" />
                </div>
              </div>

              <div class="form-actions bookmark-submit-actions">
                <button
                  type="button"
                  class="secondary"
                  @click="bookmarksStore.closeFormModal()"
                >{{ $t("取消") }}</button>
                <button type="submit" class="primary" :disabled="isSubmitting">
                  {{ isSubmitting ? '儲存中...' : '儲存書籤' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>

    <!-- 商品詳情檢視 Modal -->
    <div
      v-if="bookmarksStore.isDetailModalOpen && bookmarksStore.activeDetailBookmark"
      class="modal-backdrop open"
      @click.self="bookmarksStore.closeDetailModal()"
    >
      <section v-accessible-modal class="modal detail-layout bookmark-detail-modal">
        <button
          class="modal-close"
          type="button"
          :aria-label="$t(&quot;關閉&quot;)"
          @click="bookmarksStore.closeDetailModal()"
        >
          ×
        </button>
        <div class="detail-photo">
          <img
            v-if="bookmarksStore.activeDetailBookmark.image_url"
            :src="bookmarksStore.activeDetailBookmark.image_url"
            :alt="bookmarksStore.activeDetailBookmark.title"
            @error="handleImageError"
          />
          <div
            class="detail-photo-placeholder"
            :style="{ display: bookmarksStore.activeDetailBookmark.image_url ? 'none' : 'flex' }"
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>暫無商品圖片</span>
          </div>
        </div>
        <div class="detail-content">
          <h2>{{ bookmarksStore.activeDetailBookmark.title }}</h2>
          <p class="detail-category">
            {{ bookmarksStore.activeDetailBookmark.source_domain || '來源未知' }} •
            {{ bookmarksStore.formatPrice(bookmarksStore.activeDetailBookmark.price, bookmarksStore.activeDetailBookmark.currency) }}
          </p>

          <dl class="detail-fields">
            <div>
              <dt>{{ $t("品牌") }}</dt>
              <dd>{{ bookmarksStore.activeDetailBookmark.brand || '—' }}</dd>
            </div>
            <div>
              <dt>價格</dt>
              <dd>{{ bookmarksStore.formatPrice(bookmarksStore.activeDetailBookmark.price, bookmarksStore.activeDetailBookmark.currency) }}</dd>
            </div>
            <div>
              <dt>尺寸</dt>
              <dd>{{ bookmarksStore.activeDetailBookmark.size || '—' }}</dd>
            </div>
            <div>
              <dt>顏色</dt>
              <dd>{{ bookmarksStore.activeDetailBookmark.color || '—' }}</dd>
            </div>
            <div>
              <dt>款式</dt>
              <dd>{{ bookmarksStore.activeDetailBookmark.variant_name || '—' }}</dd>
            </div>
            <div>
              <dt>來源</dt>
              <dd>{{ bookmarksStore.activeDetailBookmark.source_domain || '—' }}</dd>
            </div>
          </dl>

          <p v-if="bookmarksStore.activeDetailBookmark.notes" class="detail-notes">
            備註：{{ bookmarksStore.activeDetailBookmark.notes }}
          </p>

          <div class="modal-actions bookmark-detail-actions">
            <button class="primary" @click="sendToStudio(bookmarksStore.activeDetailBookmark)">{{ $t('帶到試穿工作室') }}</button>
            <button
              type="button"
              class="primary"
              :disabled="convertingToCloset"
              @click="convertBookmarkToCloset(bookmarksStore.activeDetailBookmark)"
            >
              {{ $t('到工作室確認入櫥') }}
            </button>
            <button
              type="button"
              class="secondary danger-btn"
              @click="handleDeleteFromDetail(bookmarksStore.activeDetailBookmark.id)"
            >
              刪除
            </button>
            <button
              type="button"
              class="secondary"
              @click="handleEditFromDetail(bookmarksStore.activeDetailBookmark.id)"
            >
              編輯
            </button>
            <a
              v-if="bookmarksStore.activeDetailBookmark.product_url"
              class="primary bookmark-link-btn"
              :href="formatExternalUrl(bookmarksStore.activeDetailBookmark.product_url)"
              target="_blank"
              rel="noopener noreferrer"
            >
              前往商品頁面
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-left:5px;">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </a>
          </div>
        </div>
      </section>
    </div>

    <!-- 擴充套件安裝導引 Modal -->
    <div
      v-if="bookmarksStore.isExtensionGuideOpen"
      class="modal-backdrop open"
      @click.self="bookmarksStore.isExtensionGuideOpen = false"
    >
      <section v-accessible-modal class="modal extension-guide-modal">
        <button
          class="modal-close"
          type="button"
          :aria-label="$t(&quot;關閉&quot;)"
          @click="bookmarksStore.isExtensionGuideOpen = false"
        >
          ×
        </button>
        <ExtensionGuide />

        <div class="form-actions guide-footer-actions">
          <button
            type="button"
            class="primary"
            @click="handleExtensionGuideConfirm()"
          >
            我知道了，開始使用
          </button>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBookmarksStore } from '@/stores/bookmarks';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useClosetStore } from '@/stores/closet';
import { previewExternalProduct } from '@/services/productImport';
import ExtensionGuide from '@/components/bookmarks/ExtensionGuide.vue';
import SavedOutfitsCollection from '@/components/bookmarks/SavedOutfitsCollection.vue';

const bookmarksStore = useBookmarksStore();
const appStore = useAppStore();
const authStore = useAuthStore();
const closetStore = useClosetStore();
const route = useRoute();
const router = useRouter();

const sendToStudio = bookmark => {
  bookmarksStore.closeDetailModal();
  router.push({path:'/shop',query:{title:bookmark.title,url:bookmark.product_url || '',image:bookmark.image_url || ''}});
};
watch(() => route.query.extension, value => {if(value==='1') bookmarksStore.isExtensionGuideOpen=true;},{immediate:true});
const isExtraFieldsExpanded = ref(false);
const previewImageSrc = ref('');
const uploadedFile = ref(null);
const isSubmitting = ref(false);
const isMockupError = ref(false);
const importUrl = ref('');
const importLoading = ref(false);
const importError = ref('');
const importPreview = ref(null);
const convertingToCloset = ref(false);

const formData = reactive({
  title: '',
  product_url: '',
  image_url: '',
  brand: '',
  variant_name: '',
  color: '',
  size: '',
  price: '',
  currency: 'TWD',
  notes: ''
});

const getBookmarkMetaText = (bookmark) => {
  const parts = [];
  if (bookmark.brand || bookmark.source_domain) {
    parts.push(bookmark.brand || bookmark.source_domain);
  }
  if (bookmark.price) {
    parts.push(bookmarksStore.formatPrice(bookmark.price, bookmark.currency));
  }
  return parts.length ? parts.join(' · ') : (bookmark.source_domain || '商品');
};

const handleImageError = (event) => {
  event.target.style.display = 'none';
  if (event.target.nextElementSibling) {
    event.target.nextElementSibling.style.display = 'flex';
  }
};

const handleMockupError = (event) => {
  event.target.style.display = 'none';
  isMockupError.value = true;
};

const formatExternalUrl = (url) => {
  if (!url) return '#';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
};

const handleOpenExternalLink = (url) => {
  const validUrl = formatExternalUrl(url);
  if (validUrl !== '#') {
    window.open(validUrl, '_blank', 'noopener,noreferrer');
  } else {
    appStore.showToast('此商品尚未設定商品頁連結');
  }
};

const handleCardClick = (id) => {
  if (bookmarksStore.isManagerMode) {
    bookmarksStore.toggleSelectBookmark(id);
  } else {
    bookmarksStore.openDetailModal(id);
  }
};

const handleProductPreview = async () => {
  importError.value = '';
  importPreview.value = null;
  if (!authStore.isMember || !authStore.session?.access_token) {
    appStore.openLoginGate('AUTH_REQUIRED', '/bookmarks');
    return;
  }
  importLoading.value = true;
  try {
    importPreview.value = await previewExternalProduct(importUrl.value, authStore.session.access_token);
  } catch (error) {
    importError.value = error?.message || '目前無法讀取商品頁，請改用手動輸入。';
  } finally {
    importLoading.value = false;
  }
};

const parserLabel = (parser) => ({ 'json-ld': '商品結構資料', opengraph: '網頁預覽資料', metadata: '頁面資訊' }[String(parser || '').toLowerCase()] || '商品頁資訊');

const confirmImportedProduct = () => {
  const product = importPreview.value;
  if (!product) return;
  handleOpenCreateModal({
    title: product.title,
    url: product.sourceUrl,
    image: product.image,
    brand: product.brand,
    price: product.price,
    currency: product.currency || 'TWD',
    notes: `來源：${product.sourceDomain}`
  });
};

const openManualImport = () => handleOpenCreateModal({ product_url: importUrl.value });

const convertBookmarkToCloset = async (bookmark) => {
  if (!bookmark || convertingToCloset.value) return;
  if (!authStore.isMember || !authStore.profileId) {
    appStore.openLoginGate('AUTH_REQUIRED', '/bookmarks');
    return;
  }
  sendToStudio(bookmark);
  appStore.showToast('請先確認商品圖片與分類，儲存後選擇「已購買，加入衣櫥」。', {type:'info'});
};

const handleOpenCreateModal = (prefill = null) => {
  const data = prefill || {};
  formData.title = data.title || '';
  formData.product_url = data.url || data.product_url || '';
  formData.image_url = data.image || data.image_url || '';
  formData.brand = data.brand || '';
  formData.variant_name = data.variant_name || data.variant || '';
  formData.color = data.color || '';
  formData.size = data.size || '';
  formData.price = data.price ? String(data.price).replace(/[^0-9.]/g, '') : '';
  formData.currency = data.currency || 'TWD';
  formData.notes = data.notes || '';

  uploadedFile.value = null;
  previewImageSrc.value = formData.image_url;
  isExtraFieldsExpanded.value = !!(formData.brand || formData.variant_name || formData.color || formData.size || formData.price || formData.notes);

  bookmarksStore.openCreateForm();
};

const handleOpenEditModal = (id) => {
  const target = bookmarksStore.openEditForm(id);
  if (!target) return;

  formData.title = target.title || '';
  formData.product_url = target.product_url || '';
  formData.image_url = target.image_url || '';
  formData.brand = target.brand || '';
  formData.variant_name = target.variant_name || '';
  formData.color = target.color || '';
  formData.size = target.size || '';
  formData.price = target.price ? String(target.price).replace(/[^0-9.]/g, '') : '';
  formData.currency = target.currency || 'TWD';
  formData.notes = target.notes || '';

  uploadedFile.value = null;
  previewImageSrc.value = formData.image_url;
  isExtraFieldsExpanded.value = true;
};

const onImageUrlInput = () => {
  previewImageSrc.value = formData.image_url.trim();
};

const handleFileUpload = (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  uploadedFile.value = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImageSrc.value = e.target.result;
    formData.image_url = e.target.result;
  };
  reader.readAsDataURL(file);
};

const handleSubmitForm = async () => {
  if (!formData.title.trim()) {
    appStore.showToast('請填寫商品名稱');
    return;
  }

  let urlVal = formData.product_url.trim();
  if (urlVal && !/^https?:\/\//i.test(urlVal)) {
    if (urlVal.includes('.') || urlVal.startsWith('localhost')) {
      urlVal = 'https://' + urlVal;
      formData.product_url = urlVal;
    }
  }

  // 重複檢測
  const excludeId = bookmarksStore.formMode === 'edit' ? bookmarksStore.editingBookmarkId : null;
  const duplicate = bookmarksStore.findDuplicateBookmark(
    urlVal,
    formData.variant_name,
    formData.color,
    formData.size,
    excludeId
  );

  if (duplicate) {
    const confirmProceed = window.confirm(
      '您已收藏過相同網址、款式及尺寸的商品，確定仍要儲存嗎？\n點擊「確定」繼續儲存，點擊「取消」返回修改。'
    );
    if (!confirmProceed) return;
  }

  isSubmitting.value = true;
  try {
    const result = bookmarksStore.formMode === 'edit'
      ? await bookmarksStore.updateBookmark(bookmarksStore.editingBookmarkId, {...formData,product_url:urlVal}, uploadedFile.value)
      : await bookmarksStore.addBookmark({...formData,product_url:urlVal,owner_id:authStore.isMember ? authStore.profileId : null}, uploadedFile.value);
    if (!result) {
      appStore.showToast('尚未儲存成功，請稍後再試。', {type:'error',syncStatus:'REMOTE_FAILED'});
      return;
    }
    const synced = bookmarksStore.lastMutationSyncStatus === 'SYNCED';
    appStore.showToast(synced ? '書籤已儲存並同步' : '書籤已保存在此裝置', {
      type:'success',syncStatus:bookmarksStore.lastMutationSyncStatus
    });
    bookmarksStore.closeFormModal();
  } catch (err) {
    console.error('Save bookmark error:', err);
    appStore.showToast('儲存失敗，請重試', { type: 'error' });
  } finally {
    isSubmitting.value = false;
  }
};

const handleDeleteFromDetail = async (id) => {
  if (!window.confirm('確定要移除此書籤嗎？')) return;
  if (!await bookmarksStore.deleteBookmark(id)) {
    appStore.showToast('未能移除書籤，請稍後再試。', {type:'error',syncStatus:'REMOTE_FAILED'}); return;
  }
  const synced = bookmarksStore.lastMutationSyncStatus === 'SYNCED';
  appStore.showToast(
    synced ? '書籤已移除並同步' : '書籤已從此裝置移除',
    { type: synced ? 'success' : 'warning', syncStatus: bookmarksStore.lastMutationSyncStatus }
  );
};

const handleEditFromDetail = (id) => {
  bookmarksStore.closeDetailModal();
  handleOpenEditModal(id);
};

const handleBatchDelete = async () => {
  const count = bookmarksStore.selectedBookmarkIds.length;
  if (!count) return;
  if (!window.confirm(`確定要刪除選取的 ${count} 個書籤嗎？`)) return;
  const deletedCount = await bookmarksStore.deleteSelectedBookmarks();
  if (!deletedCount) {
    appStore.showToast('未能移除書籤，請稍後再試。', {type:'error',syncStatus:'REMOTE_FAILED'}); return;
  }
  const synced = bookmarksStore.lastMutationSyncStatus === 'SYNCED';
  appStore.showToast(
    synced ? `已移除並同步 ${deletedCount} 個書籤` : `已從此裝置移除 ${deletedCount} 個書籤`,
    { type: synced ? 'success' : 'warning', syncStatus: bookmarksStore.lastMutationSyncStatus }
  );
};

const handleExtensionGuideConfirm = () => {
  bookmarksStore.isExtensionGuideOpen = false;
  appStore.showToast('請依步驟於 chrome://extensions/ 載入 extension 資料夾');
};

// URL Query Params 處理 (從 Chrome Extension 傳入)
const handleUrlQueryParams = () => {
  const q = route.query;
  const rawUrl = q.url || q.product_url;
  const rawTitle = q.title || q.name;
  const rawImage = q.image || q.image_url || q.img;
  const rawPrice = q.price;
  const rawBrand = q.brand;
  const rawCurrency = q.currency;
  const rawVariant = q.variant || q.variant_name;
  const rawColor = q.color;
  const rawSize = q.size;
  const rawNotes = q.notes;

  if (rawUrl || rawTitle || rawImage || rawPrice || rawBrand || rawColor || rawSize) {
    const safeDecode = (val) => {
      if (!val) return '';
      try {
        return decodeURIComponent(String(val)).trim();
      } catch (e) {
        return String(val).trim();
      }
    };

    const prefill = {
      url: safeDecode(rawUrl),
      title: safeDecode(rawTitle),
      image: safeDecode(rawImage),
      price: safeDecode(rawPrice).replace(/[^0-9.]/g, ''),
      brand: safeDecode(rawBrand),
      currency: safeDecode(rawCurrency) || 'TWD',
      variant_name: safeDecode(rawVariant),
      color: safeDecode(rawColor),
      size: safeDecode(rawSize),
      notes: safeDecode(rawNotes)
    };

    handleOpenCreateModal(prefill);
    appStore.showToast('已從擴充功能帶入商品資訊');

    // 清除 query params 避免重複觸發
    router.replace({ path: '/bookmarks', query: {} });
  }
};

onMounted(() => {
  if (authStore.isMember && authStore.profileId) {
    bookmarksStore.fetchRemoteBookmarks(authStore.profileId);
  }
  handleUrlQueryParams();
});

watch(
  () => route.query,
  () => {
    if (route.path === '/bookmarks') {
      handleUrlQueryParams();
    }
  }
);
</script>

<style scoped>
.bookmarks-page {
  animation: rise 0.45s both;
}

.product-import-panel { display:grid; gap:16px; margin:0 0 24px; padding:24px; border:1px solid rgba(169,216,242,.7); border-radius:var(--radius-card); background:linear-gradient(135deg,var(--accent-blue-soft),var(--surface-raised)); box-shadow:var(--shadow-soft); }
.product-import-panel h2 { margin:4px 0 6px; font-size:clamp(22px,3vw,30px); }
.product-import-panel p { margin:0; color:var(--muted); }
.product-import-form { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:10px; }
.product-import-form input { min-height:48px; padding:0 16px; border:1px solid var(--line); border-radius:14px; background:var(--surface-raised); color:var(--ink); }
.import-error { color:#92564f !important; }
.import-preview { display:grid; grid-template-columns:72px minmax(0,1fr) auto; gap:14px; align-items:center; padding:14px; border-radius:16px; background:rgba(255,255,255,.78); }
.import-preview img { width:72px; height:88px; object-fit:cover; border-radius:12px; }
.import-preview-missing { display:grid; place-items:center; align-content:center; width:72px; height:88px; border:1px dashed var(--line-strong,var(--line)); border-radius:12px; background:var(--paper); color:var(--muted); font-size:24px; }
.import-preview-missing small { font-size:10px; }
.import-preview strong,.import-preview small,.import-preview span { display:block; }
.import-preview small,.import-preview span { color:var(--muted); }
.import-preview .image-needed { margin-top:5px; color:#8b5667; }
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }

.bookmarks-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}

.bookmarks-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  width: 100%;
  flex-wrap: wrap;
}

.bookmark-manager-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 16px;
}

.bookmark-manager-bar span {
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
}

.bookmark-manager-bar .danger {
  background: #c2574f;
  color: #ffffff;
  border-color: #b54941;
  font-weight: 600;
  padding: 8px 18px;
  border-radius: 10px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.bookmark-manager-bar .danger:hover:not(:disabled) {
  background: #aa453e;
  box-shadow: 0 3px 10px rgba(194, 87, 79, 0.3);
}

.bookmark-manager-bar .danger:disabled {
  background: #e8dcd9;
  color: #a89895;
  border-color: transparent;
  opacity: 0.65;
  cursor: not-allowed;
}

.bookmarks-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 22px;
}

.bookmark-card {
  min-width: 0;
  position: relative;
  animation: rise 0.45s both;
  cursor: pointer;
}

.bookmark-image-wrap {
  aspect-ratio: 4/5;
  border-radius: 17px;
  overflow: hidden;
  background: #eeeae3;
  position: relative;
  cursor: pointer;
}

.bookmark-image-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.45s ease;
  display: block;
}

.bookmark-card:hover .bookmark-image-wrap img {
  transform: scale(1.04);
}

.bookmark-card.selected .bookmark-image-wrap {
  outline: 3px solid var(--sage-dark);
  outline-offset: 2px;
}

.bookmark-select {
  position: absolute;
  top: 11px;
  left: 11px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: transparent;
  border: none;
  padding: 0;
}

.bookmark-select input {
  appearance: none;
  -webkit-appearance: none;
  width: 22px;
  height: 22px;
  border: 2px solid rgba(255, 255, 255, 0.9);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(4px);
  cursor: pointer;
  margin: 0;
  outline: none;
  display: grid;
  place-items: center;
  transition: all 0.15s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.bookmark-select input:focus-visible {
  outline: 3px solid rgba(104, 86, 157, .55);
  outline-offset: 3px;
}

.bookmark-select input:hover {
  border-color: #ffffff;
  background: rgba(0, 0, 0, 0.4);
}

.bookmark-select input:checked {
  background: var(--ink);
  border-color: var(--ink);
}

.bookmark-select input:checked::after {
  content: "✓";
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

.bookmark-card-link {
  position: absolute;
  top: 11px;
  right: 11px;
  z-index: 2;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  padding: 0;
  cursor: pointer;
  transition: transform 0.2s ease, color 0.2s ease;
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.45));
}

.bookmark-card-link:hover {
  transform: scale(1.18);
  color: #ffffff;
}

.bookmark-card-link svg {
  display: block;
}

.bookmark-info {
  padding: 13px 3px 2px;
}

.bookmark-info h3 {
  font-size: 14px;
  margin-bottom: 5px;
  font-weight: 600;
  color: var(--ink);
}

.bookmark-info p {
  color: var(--muted);
  font-size: 12px;
  margin: 0;
  line-height: 1.5;
}

.bookmark-empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
  border: 1px dashed #cfcac1;
  border-radius: 18px;
  color: var(--muted);
}

.card-no-image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  gap: 6px;
  color: var(--muted);
  background: #f0ece3;
  text-align: center;
}

.card-no-image-placeholder svg {
  color: #a5a095;
}

.card-no-image-placeholder span {
  font-size: 11px;
  font-weight: 500;
  color: #88847a;
}

/* 書籤詳情彈窗 */
.bookmark-detail-modal {
  padding: 0;
  overflow: hidden;
  max-width: 780px;
}

.bookmark-detail-modal .detail-photo {
  min-height: 420px;
  position: relative;
  background: #eeeae3;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-photo-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 380px;
  gap: 8px;
  color: var(--muted);
  text-align: center;
}

.detail-photo-placeholder svg {
  color: #a5a095;
}

.detail-photo-placeholder span {
  font-size: 12px;
  font-weight: 500;
  color: #88847a;
}

.bookmark-detail-modal .detail-content {
  padding: 36px 30px 28px;
  display: flex;
  flex-direction: column;
}

.bookmark-detail-actions {
  margin-top: auto;
  justify-content: flex-end;
  padding-top: 20px;
  gap: 10px;
  display: flex;
  align-items: center;
}

.danger-btn {
  color: #c2574f !important;
  border-color: #e8c9c6 !important;
  background: transparent !important;
  transition: all 0.2s ease;
}

.danger-btn:hover {
  background: #faecea !important;
  border-color: #c2574f !important;
  color: #a33f38 !important;
}

.bookmark-link-btn {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}

/* 手動優先書籤表單 Modal */
.bookmark-form-modal {
  padding: 32px 34px 28px;
  max-width: 860px;
  width: min(94vw, 860px);
  max-height: 88vh;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  border-radius: 22px;
}

.bookmark-form-modal::-webkit-scrollbar {
  display: none;
}

.bookmark-form-modal h2 {
  margin-bottom: 18px;
  font-family: "Playfair Display", serif;
  font-size: 26px;
  font-weight: 500;
}

.bookmark-form-layout {
  display: grid;
  grid-template-columns: 310px 1fr;
  gap: 28px;
  align-items: flex-start;
}

.bookmark-form-left {
  position: sticky;
  top: 0;
}

.bookmark-form-right {
  min-width: 0;
}

.bookmark-preview-box {
  width: 100%;
  aspect-ratio: 4/5;
  min-height: 360px;
  border-radius: 18px;
  overflow: hidden;
  background: #eeeae3;
  border: 1px solid var(--line);
  margin: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bookmark-preview-box img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 16px;
  gap: 8px;
  color: var(--muted);
  height: 100%;
}

.preview-placeholder svg {
  color: #9d988d;
}

.preview-placeholder span {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
  line-height: 1.2;
}

.preview-placeholder small {
  font-size: 10.5px;
  color: var(--muted);
  line-height: 1.3;
}

.combined-image-field {
  display: flex;
  gap: 8px;
  align-items: center;
}

.combined-image-field input {
  flex: 1;
  height: 42px;
}

.file-upload-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 42px;
  padding: 0 14px;
  border: 1px solid var(--line);
  background: var(--white);
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ink);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.file-upload-badge:hover {
  background: #ede8df;
  border-color: #bdb7aa;
}

.file-upload-badge input[type="file"] {
  display: none;
}

.bookmark-extra-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 14px 0 8px;
}

.text-button {
  border: 0;
  background: transparent;
  padding: 4px 0;
  color: var(--sage-dark);
  font-weight: 600;
  cursor: pointer;
  font-size: 12px;
}

.text-button:hover {
  text-decoration: underline;
}

.bookmark-submit-actions {
  justify-content: flex-end;
  margin-top: 18px;
  display: flex;
  gap: 10px;
}

.ext-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}

.ext-btn svg {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
  margin-top: 1px;
}

/* 擴充套件展示與介紹 Modal */
.extension-guide-modal {
  padding: 32px 30px 26px;
  max-width: 620px;
  max-height: 88vh;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  border-radius: 22px;
}

.extension-guide-modal::-webkit-scrollbar {
  display: none;
}

.extension-guide-modal h2 {
  font-family: "Playfair Display", serif;
  font-size: 26px;
  font-weight: 500;
  margin-bottom: 10px;
}

.guide-intro {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 18px;
}

.extension-mockup-showcase {
  width: 100%;
  aspect-ratio: 16/9;
  max-height: 260px;
  border-radius: 16px;
  overflow: hidden;
  background: #eeeae3;
  border: 1px solid var(--line);
  margin-bottom: 18px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.extension-mockup-showcase img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.mockup-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 16px;
  gap: 6px;
  color: var(--muted);
}

.mockup-placeholder svg {
  color: #9d988d;
  margin-bottom: 2px;
}

.mockup-placeholder strong {
  font-size: 13px;
  color: var(--ink);
}

.mockup-placeholder small {
  font-size: 11px;
  color: var(--muted);
}

.mockup-placeholder code {
  background: #e2ded5;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.guide-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.guide-step-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 12px;
  background: #f8f6f0;
  border-radius: 10px;
}

.step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--sage-dark);
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}

.guide-step-item strong {
  font-size: 13px;
  color: var(--ink);
  display: block;
  margin-bottom: 2px;
}

.guide-step-item p {
  font-size: 12px;
  color: var(--muted);
  margin: 0;
  line-height: 1.4;
}

.guide-step-item code {
  background: #e8e4dc;
  padding: 1px 5px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
}

.guide-footer-actions {
  margin-top: 14px;
  justify-content: center;
  display: flex;
}

@media (max-width: 1100px) {
  .bookmarks-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .product-import-form,.import-preview { grid-template-columns:1fr; }
  .import-preview img,.import-preview-missing { width:96px; height:112px; }
  .bookmarks-grid {
    grid-template-columns: 1fr;
  }
  .bookmarks-actions {
    justify-content: stretch;
  }
  .bookmarks-actions .primary,
  .bookmarks-actions .secondary {
    flex: 1;
  }
  .bookmark-form-modal,
  .extension-guide-modal {
    padding: 24px 16px 20px;
  }
  .bookmark-form-layout {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .bookmark-preview-box {
    width: 100%;
    max-width: 220px;
    min-height: 260px;
    margin: 0 auto;
  }
  .bookmark-submit-actions,
  .guide-footer-actions {
    flex-wrap: wrap;
  }
  .combined-image-field {
    flex-direction: column;
  }
  .file-upload-badge {
    width: 100%;
  }
}
</style>
